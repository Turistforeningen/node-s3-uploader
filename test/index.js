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
  describe('#_getRandomPath()', function() {
    it('returns a new random path', function() {
      var path;
      path = upload._getRandomPath();
      assert(/^\w{2}(\/\w{2}){2}$/.test(path));
    });
    it('returns custom random path', function() {
      var path;
      upload = new Upload(process.env.AWS_BUCKET_NAME, {
        randomPath: require('uuid').v1
      });
      path = upload._getRandomPath();
      assert(/^\w+(-\w+){4}$/.test(path));
    });
  });
  describe('#_getDestPath()', function() {
    beforeEach(function() {
      upload._getRandomPath = function() {
        'aa/bb/cc';
      };
    });
    it('returns a random avaiable path', function(done) {
      upload.s3.listObjects = function(opts, cb) {
        process.nextTick(function() {
          cb(null, {
            Contents: []
          });
        });
      };
      upload._getDestPath('some/prefix/', function(err, path) {
        assert.ifError(err);
        assert.equal(path, 'some/prefix/aa/bb/cc');
        done();
      });
    });
    it('returns error if no available path can be found', function(done) {
      upload.s3.listObjects = function(opts, cb) {
        process.nextTick(function() {
          cb(null, {
            Contents: [opts.Prefix]
          });
        });
      };
      upload._getDestPath('some/prefix/', function(err) {
        assert(err instanceof Error);
        assert.equal(err.message, 'Path some/prefix/aa/bb/cc not avaiable');
        done();
      });
    });
    it('retries five 5 times to find an avaiable path', function(done) {
      var count;
      count = 0;
      upload.s3.listObjects = function(opts, cb) {
        if (++count < 5) {
          process.nextTick(function() {
            cb(null, {
              Contents: [opts.Prefix]
            });
          });
        }
        process.nextTick(function() {
          cb(null, {
            Contents: []
          });
        });
      };
      upload._getDestPath('some/prefix/', function(err, path) {
        assert.ifError(err);
        assert.equal(path, 'some/prefix/aa/bb/cc');
        done();
      });
    });
  });
});

describe('Image', function() {
  var image;
  image = null;
  beforeEach(function() {
    var opts, src;
    src = __dirname + '/assets/photo.jpg';
    opts = {};
    image = new Upload.Image(src, opts, upload);
    image.upload._getRandomPath = function() {
      'aa/bb/cc';
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
      var version;
      version = {
        path: '/some/image.jpg'
      };
      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.Key, 'aa/bb/cc.jpg');
        done();
      };
      image._upload('aa/bb/cc', version);
    });
    it('sets upload key suffix', function(done) {
      var version;
      version = {
        path: '/some/image.jpg',
        suffix: '-small'
      };
      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.Key, 'aa/bb/cc-small.jpg');
        done();
      };
      image._upload('aa/bb/cc', version);
    });
    it('sets upload key format', function(done) {
      var version;
      version = {
        path: '/some/image.png'
      };
      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.Key, 'aa/bb/cc.png');
        done();
      };
      image._upload('aa/bb/cc', version);
    });
    it('sets default ACL', function(done) {
      var version;
      version = {
        path: '/some/image.png'
      };
      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.ACL, upload.opts.aws.acl);
        done();
      };
      image._upload('aa/bb/cc', version);
    });
    it('sets specific ACL', function(done) {
      var version;
      version = {
        path: '/some/image.png',
        awsImageAcl: 'private'
      };
      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.ACL, version.awsImageAcl);
        done();
      };
      image._upload('aa/bb/cc', version);
    });
    it('sets upload body', function(done) {
      var version;
      version = {
        path: '/some/image.png'
      };
      image.upload.s3.putObject = function(opts) {
        assert(opts.Body instanceof require('fs').ReadStream);
        assert.equal(opts.Body.path, version.path);
        done();
      };
      image._upload('aa/bb/cc', version);
    });
    it('sets upload content type for png', function(done) {
      var version;
      version = {
        path: '/some/image.png'
      };
      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.ContentType, 'image/png');
        done();
      };
      image._upload('aa/bb/cc', version);
    });
    it('sets upload content type for jpg', function(done) {
      var version;
      version = {
        path: '/some/image.jpg'
      };
      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.ContentType, 'image/jpeg');
        done();
      };
      image._upload('aa/bb/cc', version);
    });
    it('sets upload expire header for version', function(done) {
      var version;
      version = {
        path: '/some/image.jpg',
        awsImageExpires: 1234
      };
      image.upload.s3.putObject = function(opts) {
        assert(opts.Expires - Date.now() <= 1234);
        done();
      };
      image._upload('aa/bb/cc', version);
    });
    it('sets upload cache-control header for version', function(done) {
      var version;
      version = {
        path: '/some/image.jpg',
        awsImageMaxAge: 1234
      };
      image.upload.s3.putObject = function(opts) {
        assert.equal(opts.CacheControl, 'public, max-age=1234');
        done();
      };
      image._upload('aa/bb/cc', version);
    });
    it('returns etag for uploaded version', function(done) {
      var version;
      version = {
        path: '/some/image.jpg'
      };
      image._upload('aa/bb/cc', version, function(err, version) {
        assert.ifError(err);
        assert.equal(version.etag, '"f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1"');
        done();
      });
    });
    it('returns url for uploaded version', function(done) {
      var version;
      version = {
        path: '/some/image.jpg'
      };
      image._upload('aa/bb/cc', version, function(err, version) {
        assert.ifError(err);
        assert.equal(version.url, image.upload.opts.url + 'aa/bb/cc.jpg');
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
      image.getDest(function(err, path) {
        assert.ifError(err);
        assert.equal(path, image.upload.opts.aws.path + 'aa/bb/cc');
        done();
      });
    });
    it('overrides destination path prefix', function(done) {
      image.opts.awsPath = 'custom/path/';
      image.getDest(function(err, path) {
        assert.ifError(err);
        assert.equal(path, 'custom/path/aa/bb/cc');
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
          var j, len, version;
          assert.ifError(err);
          for (j = 0, len = versions.length; j < len; j++) {
            version = versions[j];
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
      var i;
      i = 0;
      image._upload = function(dest, version, cb) {
        assert.equal(dest, '/foo/bar');
        assert.equal(version, i++);
        cb(null, version + 1);
      };
      image.upload.opts.original = void 0;
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
        assert.deepEqual(versions, [
          {
            awsImageAcl: 'public',
            awsImageExpires: 31536000,
            awsImageMaxAge: 31536000,
            original: true,
            width: 111,
            height: 222,
            path: image.src
          }
        ]);
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
    var results, unlink;
    unlink = require('fs').unlink;
    results = {
      uploads: []
    };
    beforeEach(function() {
      image.upload.opts.cleanup = {};
      results.uploads = [
        {
          original: true,
          path: '/foo/bar'
        }, {
          path: '/foo/bar-2'
        }
      ];
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
      var i;
      i = 0;
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
      upload._getRandomPath = function() {
        'aa/bb/cc';
      };
    }
  });
  it('uploads image to new random path', function(done) {
    this.timeout(10000);
    upload.upload(__dirname + '/assets/portrait.jpg', {}, function(e, images) {
      var image, j, len;
      assert.ifError(e);
      for (j = 0, len = images.length; j < len; j++) {
        image = images[j];
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
    var file, opts;
    this.timeout(10000);
    file = __dirname + '/assets/portrait.jpg';
    opts = {
      path: 'path/to/image'
    };
    upload.upload(file, opts, function(err, images) {
      var image, j, len;
      assert.ifError(err);
      for (j = 0, len = images.length; j < len; j++) {
        image = images[j];
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
