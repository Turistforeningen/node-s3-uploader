Upload = require('../lib/');
assert = require('assert');
S3 = require('aws-sdk').S3;

client = null

beforeEach(function() {
  client = new Upload('turadmin', {path: 'images/'});
});

describe('new Client()', function() {
  it('should instasiate correctly', function() {
    assert(client.s3 instanceof S3);
  });

  describe('#_getRandomPath()', function() {
    it('should return return a random path', function() {
      var path = client._getRandomPath();
      assert(/^[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path));
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
    it('should return avaiable path', function(done) {
      client._uploadPathIsAvailable = function(path, cb) { return cb(null, true); };
      client._uploadGeneratePath(function(err, path) {
        assert.ifError(err);
        assert(/^[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path));
        done();
      });
    });

    it('should retry if selected path is not avaiable', function(done) {
      var i = 0;
      client._uploadPathIsAvailable = function(path, cb) { return cb(null, (++i === 5)); };
      client._uploadGeneratePath(function(err, path) {
        assert.ifError(err);
        assert.equal(i, 5);
        assert(/^[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path));
        done();
      });
    });
  });
});

