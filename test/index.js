'use strict';

var assert = require('assert');
var Upload = require('../.');

var upload = null;
var cleanup = [];

beforeEach(function() {
  upload = new Upload(process.env.AWS_BUCKET_NAME, {
    aws: {
      path: process.env.AWS_BUCKET_PATH,
      region: process.env.AWS_BUCKET_REGION,
      acl: 'public-read'
    },
    cleanup: {
      versions: true,
      original: false
    },
    original: {
      awsImageAcl: 'private',
      awsImageMaxAge: 31536000
    },
    versions: [
      {
        maxHeight: 1040,
        maxWidth: 1040,
        format: 'jpg',
        suffix: '-large',
        quality: 80
      }, {
        maxWidth: 780,
        aspect: '3:2!h',
        suffix: '-medium'
      }, {
        maxWidth: 320,
        aspect: '16:9!h',
        suffix: '-small'
      }, {
        maxHeight: 100,
        aspect: '1:1',
        format: 'png',
        suffix: '-thumb1',
        awsImageExpires: 31536000,
        cacheControl: 31536000
      }, {
        maxHeight: 250,
        maxWidth: 250,
        aspect: '1:1',
        suffix: '-thumb2',
        awsImageExpires: 31536000,
        cacheControl: 31536000
      }
    ]
  });
  if (process.env.INTEGRATION_TEST !== 'true') {
    upload.s3.listObjects = function(path, cb) {
      process.nextTick(function() {
        cb(null, {
          Contents: []
        });
      });
    };
    upload.s3.putObject = function(opts, cb) {
      process.nextTick(function() {
        cb(null, {
          ETag: '"f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1"'
        });
      });
    };
  }
});

if (process.env.INTEGRATION_TEST === 'true') {
  afterEach(function(done) {
    this.timeout(40000);
    if (cleanup.length === 0) {
      return process.nextTick(done);
    }
    upload.s3.deleteObjects({
      Delete: {
        Objects: cleanup
      }
    }, function(err) {
      if (err) {
        throw err;
      }
      cleanup = [];
      done();
    });
  });
}

describe('Upload', function() {
  describe('constructor', function() {
    it('throws error for missing awsBucketName param', function() {
      assert.throws(function() {
        new Upload();
      }, /Bucket name can not be undefined/);
    });
    it('sets default values if not provided', function() {
      upload = new Upload('myBucket');
      assert(upload.s3 instanceof require('aws-sdk').S3);
      assert.deepEqual(upload.opts, {
        aws: {
          acl: 'private',
          httpOptions: {
            timeout: 10000
          },
          maxRetries: 3,
          params: {
            Bucket: 'myBucket'
          },
          path: '',
          region: 'us-east-1',
          sslEnabled: true
        },
        cleanup: {},
        returnExif: false,
        resize: {
          quality: 70
        },
        versions: [],
        url: 'https://s3.amazonaws.com/myBucket/'
      });
    });
    it('sets default url based on AWS region', function() {
      upload = new Upload('b', {
        aws: {
          region: 'my-region-1'
        }
      });
      assert.equal(upload.opts.url, 'https://s3-my-region-1.amazonaws.com/b/');
    });
    it('sets custom url', function() {
      upload = new Upload('b', {
        url: 'http://cdn.app.com/'
      });
      assert.equal(upload.opts.url, 'http://cdn.app.com/');
    });
    it('connects to AWS S3 using environment variables', function(done) {
      this.timeout(10000);
      upload = new Upload(process.env.AWS_BUCKET_NAME);
      upload.s3.headBucket(upload.opts.aws.params, done);
    });
    it('connects to AWS S3 using constructor options', function(done) {
      this.timeout(10000);
      upload = new Upload(process.env.AWS_BUCKET_NAME, {
        aws: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });
      upload.s3.headBucket(upload.opts.aws.params, done);
    });
  });

  describe('#_randomPath()', function() {
    it('returns a new random path', function() {
      var path = upload._randomPath();
      assert(/^\w+(-\w+){4}$/.test(path));
    });

    it('returns custom random path', function() {
      var upload = new Upload(process.env.AWS_BUCKET_NAME, {
        randomPath: require('@starefossen/rand-path')
      });

      var path = upload._randomPath();
      assert(/^\w{2}(\/\w{2}){2}$/.test(path));
    });
  });
});

describe('Image', function() {
  var image;

  beforeEach(function() {
    image = new Upload.Image(__dirname + '/assets/photo.jpg', {}, upload);
    image.upload._randomPath = function() {
      return '110ec58a-a0f2-4ac4-8393-c866d813b8d1';
    };
  });

  describe('constructor', function() {
    it('sets default values', function() {
      assert(image instanceof Upload.Image);
      assert.equal(image.src, __dirname + '/assets/photo.jpg');
      assert.deepEqual(image.opts, {});
      assert(image.upload instanceof Upload);
    });
  });

  describe('#_upload()', function() {
    beforeEach(function() {
      image.upload.s3.putObject = function(opts, cb) {
        process.nextTick(function() {
          cb(null, {
            ETag: '"f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1"'
          });
        });
      };
    });

    it('sets upload key', function(done) {
      var version = {
        path: '/some/image.jpg'
      };

      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.Key, '110ec58a-a0f2-4ac4-8393-c866d813b8d1.jpg');
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload key suffix', function(done) {
      var version = {
        path: '/some/image.jpg',
        suffix: '-small'
      };

      image.upload.s3.putObject = function(opts) {
        var dest = '110ec58a-a0f2-4ac4-8393-c866d813b8d1-small.jpg';
        assert.equal(opts.Key, dest);
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload key format', function(done) {
      var version = {
        path: '/some/image.png'
      };

      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.Key, '110ec58a-a0f2-4ac4-8393-c866d813b8d1.png');
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets default ACL', function(done) {
      var version = {
        path: '/some/image.png'
      };

      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.ACL, upload.opts.aws.acl);
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets specific ACL', function(done) {
      var version = {
        path: '/some/image.png',
        awsImageAcl: 'private'
      };

      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.ACL, version.awsImageAcl);
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload body', function(done) {
      var version = {
        path: '/some/image.png'
      };

      image.upload.s3.putObject = function(opts) {
        assert(opts.Body instanceof require('fs').ReadStream);
        assert.equal(opts.Body.path, version.path);
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload content type for png', function(done) {
      var version = {
        path: '/some/image.png'
      };

      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.ContentType, 'image/png');
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload content type for jpg', function(done) {
      var version = {
        path: '/some/image.jpg'
      };

      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.ContentType, 'image/jpeg');
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload expire header for version', function(done) {
      var version = {
        path: '/some/image.jpg',
        awsImageExpires: 1234
      };

      image.upload.s3.putObject = function(opts) {
        assert(opts.Expires - Date.now() <= 1234);
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('sets upload cache-control header for version', function(done) {
      var version = {
        path: '/some/image.jpg',
        awsImageMaxAge: 1234
      };

      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.CacheControl, 'public, max-age=1234');
        done();
      };

      image._upload('110ec58a-a0f2-4ac4-8393-c866d813b8d1', version);
    });

    it('returns etag for uploaded version', function(done) {
      var version = {
        path: '/some/image.jpg'
      };

      var dest = '110ec58a-a0f2-4ac4-8393-c866d813b8d1';
      image._upload(dest, version, function(err, version) {
        assert.ifError(err);
        assert.equal(version.etag, '"f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1"');
        done();
      });
    });

    it('returns url for uploaded version', function(done) {
      var version = {
        path: '/some/image.jpg'
      };

      var dest = '110ec58a-a0f2-4ac4-8393-c866d813b8d1';
      image._upload(dest, version, function(err, version) {
        assert.ifError(err);
        assert.equal(version.url, image.upload.opts.url + dest + '.jpg');
        done();
      });
    });
  });

  describe('#getMetadata()', function() {
    it('returns image metadata without exif data', function(done) {
      image.upload.opts.returnExif = false;
      image.getMetadata(image.src, function(err, metadata) {
        assert.ifError(err);
        assert.deepEqual(metadata, {
          path: image.src,
          name: '',
          size: 631808,
          format: 'JPEG',
          colorspace: 'RGB',
          height: 2048,
          width: 1536,
          orientation: ''
        });
        done();
      });
    });

    it('returns image metadata with exif data', function(done) {
      image.upload.opts.returnExif = true;
      image.getMetadata(image.src, function(err, metadata) {
        assert.ifError(err);
        assert.equal(Object.keys(metadata).length, 9);
        assert.equal(metadata.exif.GPSInfo, '954');
        done();
      });
    });
  });

  describe('#getDest()', function() {
    it('returns destination path', function(done) {
      var dest = '110ec58a-a0f2-4ac4-8393-c866d813b8d1';

      image.getDest(function(err, path) {
        assert.ifError(err);
        assert.equal(path, image.upload.opts.aws.path + dest);
        done();
      });
    });

    it('overrides destination path prefix', function(done) {
      image.opts.awsPath = 'custom/path/';
      image.getDest(function(err, path) {
        assert.ifError(err);
        assert.equal(path, 'custom/path/110ec58a-a0f2-4ac4-8393-c866d813b8d1');
        done();
      });
    });

    it('returns fixed upload path', function(done) {
      image.opts.path = 'my/image';
      image.getDest(function(err, path) {
        assert.ifError(err);
        assert.equal(path, 'images_test/my/image');
        done();
      });
    });

    it('returns fixed upload path with custom prefix', function(done) {
      image.opts.awsPath = 'custom/path/';
      image.opts.path = 'my/image';
      image.getDest(function(err, path) {
        assert.ifError(err);
        assert.equal(path, 'custom/path/my/image');
        done();
      });
    });
  });

  describe('#resizeVersions()', function() {
    it('resizes image versions', function(done) {
      image.getMetadata(image.src, function(err, metadata) {
        assert.ifError(err);

        image.resizeVersions(function(err, versions) {
          assert.ifError(err);

          var version;
          for (var i = 0; i < versions.length; i++) {
            version = versions[i];
            require('fs').statSync(version.path);
            require('fs').unlinkSync(version.path);
          }

          done();
        }, {
          metadata: metadata
        });
      });
    });
  });

  describe('#uploadVersions()', function() {
    it('uploads image versions', function(done) {
      var i = 0;

      image._upload = function(dest, version, cb) {
        assert.equal(dest, '/foo/bar');
        assert.equal(version, i++);
        cb(null, version + 1);
      };

      image.upload.opts.original = undefined;

      image.uploadVersions(function(err, versions) {
        assert.ifError(err);
        assert.deepEqual(versions, [1, 2, 3, 4]);
        done();
      }, {
        versions: [0, 1, 2, 3],
        dest: '/foo/bar'
      });
    });

    it('uploads original image', function(done) {
      image._upload = function(dest, version, cb) {
        assert.deepEqual(version, {
          awsImageAcl: 'public',
          awsImageExpires: 31536000,
          awsImageMaxAge: 31536000,
          original: true,
          width: 111,
          height: 222,
          path: image.src
        });

        cb(null, version);
      };

      image.upload.opts.original = {
        awsImageAcl: 'public',
        awsImageExpires: 31536000,
        awsImageMaxAge: 31536000
      };

      image.uploadVersions(function(err, versions) {
        assert.ifError(err);

        assert.deepEqual(versions, [{
          awsImageAcl: 'public',
          awsImageExpires: 31536000,
          awsImageMaxAge: 31536000,
          original: true,
          width: 111,
          height: 222,
          path: image.src
        }]);

        done();
      }, {
        versions: [],
        dest: '/foo/bar',
        metadata: {
          width: 111,
          height: 222
        }
      });
    });
  });

  describe('#removeVersions()', function() {
    var unlink = require('fs').unlink;
    var results = {
      uploads: []
    };

    beforeEach(function() {
      image.upload.opts.cleanup = {};
      results.uploads = [{
        original: true,
        path: '/foo/bar'
      }, {
        path: '/foo/bar-2'
      }];
    });

    afterEach(function() {
      require('fs').unlink = unlink;
    });

    it('keeps all local images', function(done) {
      require('fs').unlink = function() {
        assert.fail(new Error('unlink shall not be called'));
      };
      image.removeVersions(done, results);
    });

    it('removes image versions by default', function(done) {
      require('fs').unlink = function(path, cb) {
        assert.equal(path, results.uploads[1].path);
        cb();
      };

      image.upload.opts.cleanup.versions = true;
      image.removeVersions(done, results);
    });

    it('removes original image', function(done) {
      require('fs').unlink = function(path, cb) {
        assert.equal(path, results.uploads[0].path);
        cb();
      };

      image.upload.opts.cleanup.original = true;
      image.removeVersions(done, results);
    });

    it('removes all images', function(done) {
      var i = 0;

      require('fs').unlink = function(path, cb) {
        assert.equal(path, results.uploads[i++].path);
        cb();
      };

      image.upload.opts.cleanup.original = true;
      image.upload.opts.cleanup.versions = true;
      image.removeVersions(done, results);
    });
  });
});

describe('Integration Tests', function() {
  beforeEach(function() {
    if (process.env.INTEGRATION_TEST !== 'true') {
      upload._randomPath = function() {
        return '110ec58a-a0f2-4ac4-8393-c866d813b8d1';
      };
    }
  });

  it('uploads image to new random path', function(done) {
    this.timeout(10000);
    upload.upload(__dirname + '/assets/portrait.jpg', {}, function(e, images) {
      assert.ifError(e);

      var image;
      for (var i = 0; images.length < 0; i++) {
        image = images[i];

        if (image.key) {
          cleanup.push({
            Key: image.key
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
      }

      done();
    });
  });

  it('uploads image to fixed path', function(done) {
    this.timeout(10000);

    var file = __dirname + '/assets/portrait.jpg';
    var opts = {
      path: 'path/to/image'
    };

    upload.upload(file, opts, function(err, images) {
      assert.ifError(err);

      var image;

      for (var i = 0; i < images.length; i++) {
        image = images[i];

        if (image.key) {
          cleanup.push({
            Key: image.key
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
      }

      done();
    });
  });
});
