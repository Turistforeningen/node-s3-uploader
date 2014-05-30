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

  describe('_getRandomPath', function() {
    it('should return return a random path', function() {
      var path = client._getRandomPath();
      assert(/^[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path));
    });
  });
});

