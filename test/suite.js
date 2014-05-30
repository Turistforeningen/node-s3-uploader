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
});

