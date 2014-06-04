var assert = require('assert');
var async = require('async');
var path = require('path');
var S3 = require('aws-sdk').S3;
var gm = require('gm').subClass({imageMagick: true});

var hash = require('crypto').createHash
var rand = require('crypto').pseudoRandomBytes

var Upload = require('../lib/');
var client = null;
var cleanup = [];
var assetsDir = path.resolve('./test/assets');

beforeEach(function() {
  client = new Upload('turadmin', {
    awsBucketUrl: 'https://s3-eu-west-1.amazonaws.com/turadmin/',
    awsBucketPath: 'images_test/',
    awsBucketAcl: 'public-read',
    versions: [{
      original: true,
      acl: 'private'
    },{
      maxHeight: 1040,
      maxWidth: 1040,
      suffix: '-large',
      quality: 80
    },{
      maxHeight: 780,
      maxWidth: 780,
      suffix: '-medium'
    },{
      maxHeight: 320,
      maxWidth: 320,
      suffix: '-small'
    }],
  });

  // Mock S3 API calls
  if (process.env.INTEGRATION_TEST !== 'true') {
    client.s3.listObjects = function(path, cb) {
      cb(null, {Contents: []});
    };
    client.s3.putObject = function(opts, cb) {
      cb(null, {ETag: hash('md5').update(rand(32)).digest('hex')});
    };
  };
});

// Clean up S3 objects
if (process.env.INTEGRATION_TEST === 'true') {
  afterEach(function(done) {
    if (cleanup.length === 0) { return process.nextTick(done); }

    client.s3.deleteObjects({Delete: {Objects: cleanup}}, function(err) {
      if (err) { throw err; }
      cleanup = [];
      done();
    });
  });
}

describe('new Client()', function() {
  it('should instasiate correctly', function() {
    assert(client.s3 instanceof S3);
    // @TODO assert client.awsBucketPath
    // @TODO assert client.awsBucketUrl
    // @TODO assert client.versions
    // @TODO assert client.resizeQuality
  });

  describe('#_getRandomPath()', function() {
    it('should return a new random path', function() {
      var path = client._getRandomPath();
      assert(/^images_test\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path));
    });
  });

  describe('#_uploadPathIsAvailable()', function() {
    it('should return true for avaiable path', function(done) {
      client.s3.listObjects = function(opts, cb) { return cb(null, {Contents: []}); }
      client._uploadPathIsAvailable('some/path/', function(err, path, isAvaiable) {
        assert.ifError(err);
        assert.equal(isAvaiable, true);
        done();
      });
    });

    it('should return false for unavaiable path', function(done) {
      client.s3.listObjects = function(opts, cb) { return cb(null, {Contents: [opts.Prefix]}); }
      client._uploadPathIsAvailable('some/path/', function(err, path, isAvaiable) {
        assert.ifError(err);
        assert.equal(isAvaiable, false);
        done();
      });
    });
  });

  describe('#_uploadGeneratePath()', function() {
    it('should return an avaiable path', function(done) {
      client._uploadPathIsAvailable = function(path, cb) { return cb(null, path, true); };
      client._uploadGeneratePath(function(err, path) {
        assert.ifError(err);
        assert(/^images_test\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path));
        done();
      });
    });
  });

  describe('#_getImageMeta()', function() {
    it('should return image size');
    it('should return image format');
    it('should return image filesize');
  });

  describe('#_resizeImage()', function() {
    var version;

    beforeEach(function() {
      version = JSON.parse(JSON.stringify(client.versions[1]));
      version.path = '/some/path/file';
    });

    it('should update version object for normal versions', function(done) {
      this.timeout(5000);
      client._resizeImage(path.join(assetsDir, 'photo.jpg'), version, function(err, b, v) {
        assert.ifError(err);

        assert.deepEqual(v, {
          suffix: '-large',
          quality: 80,
          width: 1040,
          height: 1040,
          path: '/some/path/file.jpg',
          type: 'image/jpeg'
        });

        done();
      });
    });

    it('should return resized Buffer for JPEG images', function(done) {
      this.timeout(5000);
      client._resizeImage(path.join(assetsDir, 'photo.jpg'), version, function(err, buffer) {
        assert.ifError(err);

        gm(buffer).identify(function(err, value) {
          assert.ifError(err);

          assert.equal(value.Quality, '80');
          assert.equal(value.Compression, 'JPEG');
          assert.equal(value.Colorspace, 'RGB');
          assert.equal(value.size.width, 780);
          assert.equal(value.size.height, 1040);

          done();
        });
      });
    });

    it('should return resized Buffer for PNG images', function(done) {
      this.timeout(5000);
      client._resizeImage(path.join(assetsDir, 'photo.png'), version, function(err, buffer) {
        assert.ifError(err);

        gm(buffer).identify(function(err, value) {
          assert.ifError(err);

          assert.equal(value.Quality, '80');
          assert.equal(value.Compression, 'JPEG');
          assert.equal(value.Colorspace, 'RGB');
          assert.equal(value.size.width, 1040);
          assert.equal(value.size.height, 780);

          done();
        });
      });
    });

    it('should return resized Buffer for TIFF images', function(done) {
      this.timeout(5000);
      client._resizeImage(path.join(assetsDir, 'photo.tiff'), version, function(err, buffer) {
        assert.ifError(err);

        gm(buffer).identify(function(err, value) {
          assert.ifError(err);

          assert.equal(value.Quality, '80');
          assert.equal(value.Compression, 'JPEG');
          assert.equal(value.Colorspace, 'RGB');
          assert.equal(value.size.width, 780);
          assert.equal(value.size.height, 1040);

          done();
        });
      });
    });

    it('should converte CMYK colorspace to RGB', function(done) {
      this.timeout(5000);
      client._resizeImage(path.join(assetsDir, 'cmyk.jpg'), version, function(err, buffer) {
        assert.ifError(err);

        gm(buffer).identify(function(err, value) {
          assert.ifError(err);

          assert.equal(value.Colorspace, 'RGB');

          done();
        });
      });
    });

    it('should auto rotate images');

    it('should return a readStream for the original version', function(done) {
      version = {original: true};
      var filePath = path.join(assetsDir, 'photo.jpg');
      client._resizeImage(filePath, version, function(err, stream) {
        assert.ifError(err);

        assert.equal(stream.readable, true);
        assert.equal(stream.path, filePath);

        done();
      });
    });
  });

  describe('#_uploadImage()', function() {
    it('should set correct S3 options');
    it('should handle S3 upload failure');
    it('should upload Buffer image to S3');
    it('should upload readStream image to S3');
  });

  describe('upload()', function() {
    this.timeout(10000);

    it('should upload this awesome image', function(done) {
      client.upload(path.join(assetsDir, 'photo.jpg'), function(err, images) {
        assert.ifError(err);

        // @TODO assert things here

        for(var i = 0; i < images.length; i++) {
          cleanup.push({Key: images[i].path});
        }

        done()
      });
    });

    it('should upload multiple images successfully', function(done) {
      this.timeout(30000);

      var images = [
        path.join(assetsDir, 'photo.jpg'),
        path.join(assetsDir, 'photo.jpg'),
        path.join(assetsDir, 'photo.jpg'),
        path.join(assetsDir, 'photo.jpg'),
        path.join(assetsDir, 'photo.jpg')
      ];

      // 2 images simmultaniously seams to be optimal for S3
      // 1 image at a time seam to be optimal locally
      async.mapLimit(images, 2, client.upload.bind(client), function(err, images) {
        assert.ifError(err);

        // @TODO assert things here

        for(var i = 0; i < images.length; i++) {
          for(var j = 0; j < images[i].length; j++) {
            cleanup.push({Key: images[i][j].path});
          }
        }

        done()
      });
    });
  });
});

