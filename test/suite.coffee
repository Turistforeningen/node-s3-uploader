assert = require 'assert'
Upload = require '../src/index.coffee'

hash = require('crypto').createHash
rand = require('crypto').pseudoRandomBytes

client = null

beforeEach ->
  client = new Upload 'turadmin',
    awsBucketUrl: 'https://s3-eu-west-1.amazonaws.com/turadmin/'
    awsBucketPath: 'images_test/'
    awsBucketAcl: 'public-read'
    versions: [{
      original: true
      awsImageAcl: 'private'
    },{
      maxHeight: 1040
      maxWidth: 1040
      suffix: '-large'
      quality: 80
    },{
      maxHeight: 780
      maxWidth: 780
      suffix: '-medium'
    },{
      maxHeight: 320
      maxWidth: 320
      suffix: '-small'
    }]

  # Mock S3 API calls
  if process.env.INTEGRATION_TEST isnt 'true' and true
    client.s3.listObjects = (path, cb) ->
      process.nextTick -> cb null, Contents: []

    client.s3.putObject = (opts, cb) ->
      process.nextTick -> cb null, ETag: hash('md5').update(rand(32)).digest('hex')

describe 'Upload', ->
  @timeout 20000
  describe '#upload()', ->
    it 'should upload', (done) ->
      client.upload 'test/assets/photo.tiff', {}, (err, versions, meta) ->
        assert.ifError err
        console.log versions
        done()

