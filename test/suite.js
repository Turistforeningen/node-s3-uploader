Upload = require('../lib/');
assert = require('assert');
path = require('path');
S3 = require('aws-sdk').S3;

client = null

beforeEach(function() {
  client = new Upload('turadmin', {
    url: 'https://s3-eu-west-1.amazonaws.com/turadmin/',
    path: 'images_test/'
  });
});

describe('new Client()', function() {
  it('should instasiate correctly', function() {
    assert(client.s3 instanceof S3);
  });

  describe('#_getRandomPath()', function() {
    it('should return a new random path', function() {
      var path = client._getRandomPath();
      assert(/^images_test\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path));
    });
  });

  describe('#_uploadPathIsAvailable()', function() {
    it('should return true for avaiable path', function(done) {
      client._uploadPathIsAvailable('this/should/not/exist', function(err, isAvaiable) {
        assert.ifError(err);
        assert.equal(isAvaiable, true);
        done();
      });
    });

    it('should return false for unavaiable path', function(done) {
      client._uploadPathIsAvailable('images/', function(err, isAvaiable) {
        assert.ifError(err);
        assert.equal(isAvaiable, false);
        done();
      });
    });
  });

  describe('#_uploadGeneratePath()', function() {
    it('should return an avaiable path', function(done) {
      client._uploadPathIsAvailable = function(path, cb) { return cb(null, true); };
      client._uploadGeneratePath(function(err, path) {
        assert.ifError(err);
        assert(/^images_test\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path));
        done();
      });
    });

    it('should retry if selected path is not avaiable', function(done) {
      var i = 0;
      client._uploadPathIsAvailable = function(path, cb) { return cb(null, (++i === 5)); };
      client._uploadGeneratePath(function(err, path) {
        assert.ifError(err);
        assert.equal(i, 5);
        assert(/^images_test\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path));
        done();
      });
    });
  });

  describe.only('#_upload()', function() {
    beforeEach(function() {
      client._getRandomPath = function() { return 'images_test/ab/cd/ef' };
      client._uploadPathIsAvailable = function(path, cb) { return cb(null, true); };
    });

    var files = [{
      tmpName: path.resolve('./test/assets/hans.jpg'),
      contentType: 'image/jpeg',
      ext: 'jpg',
      org: true,
      height: 1366,
      width: 1024
    },{
      tmpName: path.resolve('./test/assets/hans-500.jpg'),
      contentType: 'image/jpeg',
      ext: 'jpg',
      height: 500,
      width: 375
    },{
      tmpName: path.resolve('./test/assets/hans-200.jpg'),
      contentType: 'image/jpeg',
      ext: 'jpg',
      height: 200,
      width: 150
    }];

    it('should upload all files successfully', function(done) {
      this.timeout(10000);

      if (process.env.INTEGRATION_TEST !== 'true') {
        var etags = {
          'images_test/ab/cd/ef.jpg': '"9c4eec0786092f06c9bb75886bdd255b"',
          'images_test/ab/cd/ef-375.jpg': '"a8b7ced47f0a0287de13e21c0ce03f4f"',
          'images_test/ab/cd/ef-150.jpg': '"20605bd03842d527d9cf16660810ffa0"'
        }
        client.s3.putObject = function(opts, cb) { return cb(null, {ETag: etags[opts.Key]}); }
      }

      client._upload(files, function(err, results) {
        assert.ifError(err);

        assert(results instanceof Array);
        assert.equal(results.length, 3);

        assert.equal(typeof results[0].tmpName, 'string');
        assert.equal(results[0].contentType, 'image/jpeg');
        assert.equal(results[0].ext, 'jpg');
        assert.equal(typeof results[0].height, 'number');
        assert.equal(typeof results[0].width, 'number');
        assert.equal(typeof results[0].key, 'string');
        assert.equal(typeof results[0].url, 'string');
        assert.equal(typeof results[0].etag, 'string');

        done()
      });
    });
  });
});

