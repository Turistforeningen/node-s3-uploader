'use strict';

const assert = require('assert');
const Upload = require('../.');

const fs = require('fs');
const S3 = require('aws-sdk').S3;
const ReadStream = require('fs').ReadStream;
const statSync = require('fs').statSync;
const unlinkSync = require('fs').unlinkSync;

const randomPath = require('@starefossen/rand-path');

let upload;
let cleanup = [];

beforeEach(() => {
  upload = new Upload(process.env.AWS_BUCKET_NAME, {
    aws: {
      path: process.env.AWS_BUCKET_PATH,
      region: process.env.AWS_BUCKET_REGION,
      acl: 'public-read',
    },
    cleanup: {
      versions: true,
      original: false,
    },
    original: {
      awsImageAcl: 'private',
      awsImageMaxAge: 31536000,
    },
    versions: [
      {
        maxHeight: 1040,
        maxWidth: 1040,
        format: 'jpg',
        suffix: '-large',
        quality: 80,
      }, {
        maxWidth: 780,
        aspect: '3:2!h',
        suffix: '-medium',
      }, {
        maxWidth: 320,
        aspect: '16:9!h',
        suffix: '-small',
      }, {
        maxHeight: 100,
        aspect: '1:1',
        format: 'png',
        suffix: '-thumb1',
        awsImageExpires: 31536000,
        cacheControl: 31536000,
      }, {
        maxHeight: 250,
        maxWidth: 250,
        aspect: '1:1',
        suffix: '-thumb2',
        awsImageExpires: 31536000,
        cacheControl: 31536000,
      },
    ],
  });
  if (process.env.INTEGRATION_TEST !== 'true') {
    upload.s3.listObjects = (path, cb) => {
      process.nextTick(() => {
        cb(null, { Contents: [] });
      });
    };
    upload.s3.putObject = (opts, cb) => {
      process.nextTick(() => {
        cb(null, { ETag: '"f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1"' });
      });
    };
  }
});

if (process.env.INTEGRATION_TEST === 'true') {
  afterEach(function afterEach(done) {
    this.timeout(40000);

    if (cleanup.length === 0) {
      return process.nextTick(done);
    }

    return upload.s3.deleteObjects({
      Delete: {
        Objects: cleanup,
      },
    }, (err) => {
      if (err) { throw err; }
      cleanup = [];
      done();
    });
  });
}

describe('Upload', () => {
  describe('constructor', () => {
    it('throws error for missing awsBucketName param', () => {
      assert.throws(() => {
        const client = new Upload();
        assert.equal(client, null);
      }, /Bucket name can not be undefined/);
    });

    it('sets default values if not provided', () => {
      upload = new Upload('myBucket');
      assert(upload.s3 instanceof S3);
      assert.deepEqual(upload.opts, {
        aws: {
          acl: 'private',
          httpOptions: {
            timeout: 10000,
          },
          maxRetries: 3,
          params: {
            Bucket: 'myBucket',
          },
          path: '',
          region: 'us-east-1',
          sslEnabled: true,
        },
        cleanup: {},
        returnExif: false,
        resize: {
          quality: 70,
        },
        versions: [],
        url: 'https://s3.amazonaws.com/myBucket/',
      });
    });
    it('sets default url based on AWS region', () => {
      upload = new Upload('b', {
        aws: {
          region: 'my-region-1',
        },
      });
      assert.equal(upload.opts.url, 'https://s3-my-region-1.amazonaws.com/b/');
    });

    it('sets custom url', () => {
      upload = new Upload('b', {
        url: 'http://cdn.app.com/',
      });
      assert.equal(upload.opts.url, 'http://cdn.app.com/');
    });

    it('connects to AWS S3 using environment constiables', function it(done) {
      this.timeout(10000);
      upload = new Upload(process.env.AWS_BUCKET_NAME);
      upload.s3.headBucket(upload.opts.aws.params, done);
    });

    it('connects to AWS S3 using constructor options', function it(done) {
      this.timeout(10000);
      upload = new Upload(process.env.AWS_BUCKET_NAME, {
        aws: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      upload.s3.headBucket(upload.opts.aws.params, done);
    });
  });

  describe('#_randomPath()', () => {
    it('returns a new random path', () => {
      const path = upload._randomPath();
      assert(/^\w+(-\w+){4}$/.test(path));
    });

    it('returns custom random path', () => {
      upload = new Upload(process.env.AWS_BUCKET_NAME, { randomPath });

      const path = upload._randomPath();
      assert(/^\w{2}(\/\w{2}){2}$/.test(path));
    });
  });
});

describe('Image', () => {
  let image;

  beforeEach(() => {
    image = new Upload.Image(`${__dirname}/assets/photo.jpg`, {}, upload);
    image.upload._randomPath = () => '110ec58a-a0f2-4ac4-8393-c866d813b8d1';
  });

  describe('constructor', () => {
    it('sets default values', () => {
      assert(image instanceof Upload.Image);
      assert.equal(image.src, `${__dirname}/assets/photo.jpg`);
      assert.deepEqual(image.opts, {});
      assert(image.upload instanceof Upload);
    });
  });

  describe('#_upload()', () => {
    beforeEach(() => {
      image.upload.s3.putObject = (opts, cb) => {
        process.nextTick(() => {
          cb(null, { ETag: '"f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1"' });
        });
      };
    });

    it('sets upload key', done => {
      const version = { path: '/some/image.jpg' };

      image.upload.s3.putObject = (opts) => {
        assert.equal(opts.Key, '110ec58a-a0f2-4ac4-8393-c866d813b8d1.jpg');
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload key suffix', done => {
      const version = {
        path: '/some/image.jpg',
        suffix: '-small',
      };

      image.upload.s3.putObject = (opts) => {
        const dest = '110ec58a-a0f2-4ac4-8393-c866d813b8d1-small.jpg';
        assert.equal(opts.Key, dest);
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload key format', done => {
      const version = {
        path: '/some/image.png',
      };

      image.upload.s3.putObject = (opts) => {
        assert.equal(opts.Key, '110ec58a-a0f2-4ac4-8393-c866d813b8d1.png');
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets default ACL', done => {
      const version = {
        path: '/some/image.png',
      };

      image.upload.s3.putObject = (opts) => {
        assert.equal(opts.ACL, upload.opts.aws.acl);
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets specific ACL', done => {
      const version = {
        path: '/some/image.png',
        awsImageAcl: 'private',
      };

      image.upload.s3.putObject = (opts) => {
        assert.equal(opts.ACL, version.awsImageAcl);
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload body', done => {
      const version = {
        path: '/some/image.png',
      };

      image.upload.s3.putObject = (opts) => {
        assert(opts.Body instanceof ReadStream);
        assert.equal(opts.Body.path, version.path);
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload content type for png', done => {
      const version = {
        path: '/some/image.png',
      };

      image.upload.s3.putObject = (opts) => {
        assert.equal(opts.ContentType, 'image/png');
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload content type for jpg', done => {
      const version = {
        path: '/some/image.jpg',
      };

      image.upload.s3.putObject = (opts) => {
        assert.equal(opts.ContentType, 'image/jpeg');
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload expire header for version', done => {
      const version = {
        path: '/some/image.jpg',
        awsImageExpires: 1234,
      };

      image.upload.s3.putObject = (opts) => {
        assert(opts.Expires - Date.now() <= 1234);
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload cache-control header for version', done => {
      const version = {
        path: '/some/image.jpg',
        awsImageMaxAge: 1234,
      };

      image.upload.s3.putObject = (opts) => {
        assert.equal(opts.CacheControl, 'public, max-age=1234');
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('returns etag for uploaded version', done => {
      const version1 = {
        path: '/some/image.jpg',
      };

      const dest = '110ec58a-a0f2-4ac4-8393-c866d813b8d1';
      image._upload(dest, version1, (err, version2) => {
        assert.ifError(err);
        assert.equal(version2.etag, '"f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1"');
        done();
      });
    });

    it('returns url for uploaded version', done => {
      const version1 = {
        path: '/some/image.jpg',
      };

      const dest = '110ec58a-a0f2-4ac4-8393-c866d813b8d1';
      image._upload(dest, version1, (err, version2) => {
        assert.ifError(err);
        assert.equal(version2.url, `${image.upload.opts.url}${dest}.jpg`);
        done();
      });
    });
  });

  describe('#getMetadata()', () => {
    it('returns image metadata without exif data', done => {
      image.upload.opts.returnExif = false;
      image.getMetadata(image.src, (err, metadata) => {
        assert.ifError(err);
        assert.deepEqual(metadata, {
          path: image.src,
          name: '',
          size: 631808,
          format: 'JPEG',
          colorspace: 'RGB',
          height: 2048,
          width: 1536,
          orientation: '',
        });
        done();
      });
    });

    it('returns image metadata with exif data', done => {
      image.upload.opts.returnExif = true;
      image.getMetadata(image.src, (err, metadata) => {
        assert.ifError(err);
        assert.equal(Object.keys(metadata).length, 9);
        assert.equal(metadata.exif.GPSInfo, '954');
        done();
      });
    });
  });

  describe('#getDest()', () => {
    it('returns destination path', done => {
      const dest = '110ec58a-a0f2-4ac4-8393-c866d813b8d1';

      image.getDest((err, path) => {
        assert.ifError(err);
        assert.equal(path, image.upload.opts.aws.path + dest);
        done();
      });
    });

    it('overrides destination path prefix', done => {
      image.opts.awsPath = 'custom/path/';
      image.getDest((err, path) => {
        assert.ifError(err);
        assert.equal(path, 'custom/path/110ec58a-a0f2-4ac4-8393-c866d813b8d1');
        done();
      });
    });

    it('returns fixed upload path', done => {
      image.opts.path = 'my/image';
      image.getDest((err, path) => {
        assert.ifError(err);
        assert.equal(path, 'images_test/my/image');
        done();
      });
    });

    it('returns fixed upload path with custom prefix', done => {
      image.opts.awsPath = 'custom/path/';
      image.opts.path = 'my/image';
      image.getDest((err, path) => {
        assert.ifError(err);
        assert.equal(path, 'custom/path/my/image');
        done();
      });
    });
  });

  describe('#resizeVersions()', () => {
    it('resizes image versions', done => {
      image.getMetadata(image.src, (err1, metadata) => {
        assert.ifError(err1);

        image.resizeVersions((err2, versions) => {
          assert.ifError(err2);

          versions.forEach(version => {
            statSync(version.path);
            unlinkSync(version.path);
          });

          done();
        }, { metadata });
      });
    });
  });

  describe('#uploadVersions()', () => {
    it('uploads image versions', done => {
      let i = 0;

      image._upload = (dest, version, cb) => {
        assert.equal(dest, '/foo/bar');
        assert.equal(version, i++);
        cb(null, version + 1);
      };

      image.upload.opts.original = undefined;

      image.uploadVersions((err, versions) => {
        assert.ifError(err);
        assert.deepEqual(versions, [1, 2, 3, 4]);
        done();
      }, {
        versions: [0, 1, 2, 3],
        dest: '/foo/bar',
      });
    });

    it('uploads original image', done => {
      image._upload = (dest, version, cb) => {
        assert.deepEqual(version, {
          awsImageAcl: 'public',
          awsImageExpires: 31536000,
          awsImageMaxAge: 31536000,
          original: true,
          width: 111,
          height: 222,
          path: image.src,
        });

        cb(null, version);
      };

      image.upload.opts.original = {
        awsImageAcl: 'public',
        awsImageExpires: 31536000,
        awsImageMaxAge: 31536000,
      };

      image.uploadVersions((err, versions) => {
        assert.ifError(err);

        assert.deepEqual(versions, [{
          awsImageAcl: 'public',
          awsImageExpires: 31536000,
          awsImageMaxAge: 31536000,
          original: true,
          width: 111,
          height: 222,
          path: image.src,
        }]);

        done();
      }, {
        versions: [],
        dest: '/foo/bar',
        metadata: {
          width: 111,
          height: 222,
        },
      });
    });
  });

  describe('#removeVersions()', () => {
    const unlink = fs.unlink;
    const results = {
      uploads: [],
    };

    beforeEach(() => {
      image.upload.opts.cleanup = {};
      results.uploads = [{
        original: true,
        path: '/foo/bar',
      }, {
        path: '/foo/bar-2',
      }];
    });

    afterEach(() => {
      fs.unlink = unlink;
    });

    it('keeps all local images', done => {
      fs.unlink = () => {
        assert.fail(new Error('unlink shall not be called'));
      };
      image.removeVersions(done, results);
    });

    it('removes image versions by default', done => {
      fs.unlink = (path, cb) => {
        assert.equal(path, results.uploads[1].path);
        cb();
      };

      image.upload.opts.cleanup.versions = true;
      image.removeVersions(done, results);
    });

    it('removes original image', done => {
      fs.unlink = (path, cb) => {
        assert.equal(path, results.uploads[0].path);
        cb();
      };

      image.upload.opts.cleanup.original = true;
      image.removeVersions(done, results);
    });

    it('removes all images', done => {
      let i = 0;

      fs.unlink = (path, cb) => {
        assert.equal(path, results.uploads[i++].path);
        cb();
      };

      image.upload.opts.cleanup.original = true;
      image.upload.opts.cleanup.versions = true;
      image.removeVersions(done, results);
    });
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    if (process.env.INTEGRATION_TEST !== 'true') {
      upload._randomPath = () => '110ec58a-a0f2-4ac4-8393-c866d813b8d1';
    }
  });

  it('uploads image to new random path', function it(done) {
    this.timeout(10000);
    upload.upload(`${__dirname}/assets/portrait.jpg`, {}, (e, images) => {
      assert.ifError(e);

      images.forEach(image => {
        if (image.key) {
          cleanup.push({
            Key: image.key,
          });
        }

        assert.equal(typeof image.etag, 'string');
        assert.equal(typeof image.path, 'string');
        assert.equal(typeof image.key, 'string');
        /^images_test(\/[\w]{2}){3}/.test(image.key);
        assert.equal(typeof image.url, 'string');

        if (image.original) {
          assert.equal(image.original, true);
        } else {
          assert.equal(typeof image.suffix, 'string');
          assert.equal(typeof image.height, 'number');
          assert.equal(typeof image.width, 'number');
        }
      });

      done();
    });
  });

  it('uploads image to fixed path', function it(done) {
    this.timeout(10000);

    const file = `${__dirname}/assets/portrait.jpg`;
    const opts = {
      path: 'path/to/image',
    };

    upload.upload(file, opts, (err, images) => {
      assert.ifError(err);

      images.forEach(image => {
        if (image.key) {
          cleanup.push({
            Key: image.key,
          });
        }

        assert.equal(typeof image.etag, 'string');
        assert.equal(typeof image.path, 'string');
        assert.equal(typeof image.key, 'string');
        /^images_test\/path\/to\/image/.test(image.key);
        assert.equal(typeof image.url, 'string');

        if (image.original) {
          assert.equal(image.original, true);
        } else {
          assert.equal(typeof image.suffix, 'string');
          assert.equal(typeof image.height, 'number');
          assert.equal(typeof image.width, 'number');
        }
      });

      done();
    });
  });
});
