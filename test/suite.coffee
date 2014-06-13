assert = require 'assert'
Upload = require '../src/index.coffee'

hash = require('crypto').createHash
rand = require('crypto').pseudoRandomBytes

S3 = require('aws-sdk').S3

client = null
cleanup = []

beforeEach ->
  client = new Upload 'turadmin',
    awsBucketPath: 'images_test/'
    awsBucketUrl: 'https://s3-eu-west-1.amazonaws.com/turadmin/'
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
  if process.env.INTEGRATION_TEST isnt 'true'
    client.s3.listObjects = (path, cb) ->
      process.nextTick -> cb null, Contents: []

    client.s3.putObject = (opts, cb) ->
      process.nextTick -> cb null, ETag: hash('md5').update(rand(32)).digest('hex')

# Clean up S3 objects
if process.env.INTEGRATION_TEST is 'true'
  afterEach (done) ->
    return process.nextTick done if cleanup.length is 0

    client.s3.deleteObjects Delete: Objects: cleanup, (err) ->
      throw err if err
      cleanup = []
      done()

describe 'Upload', ->
  describe 'constructor', ->
    it 'should set default values if not provided', ->
      client = new Upload 'myBucket'

      assert client.s3 instanceof S3
      assert client.versions instanceof Array
      assert.equal client.awsBucketPath, ''
      assert.equal client.awsBucketUrl, undefined
      assert.equal client.awsBucketAcl, 'privat'
      assert.equal client.resizeQuality, 70
      assert.equal client.keepOriginal, true
      assert.equal client.returnExif, false
      assert.equal client.tmpDir, '/tmp/'
      assert.equal client.tmpPrefix, 'gm-'

    it 'should override default values'

  describe '#_getRandomPath()', ->
    it 'should return a new random path', ->
      path = client._getRandomPath()
      assert(/^images_test\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path))

  describe '#_uploadPathIsAvailable()', ->
    it 'should return true for avaiable path'
    it 'should return false for unavaiable path'

  describe '#__uploadGeneratePath()', ->
    it 'should return an avaiable path'

  describe '#upload()', ->
    describe 'Image', ->
      image = null

      beforeEach ->
        src = __dirname + 'test/assets/photo.jpg'
        dest = 'images_test/Wm/PH/f3/I0'
        opts = {}

        image = new Upload.Image src, dest, opts, client

      describe 'constructor', ->
        it 'should set default values'

      describe '#getMeta()', ->
        it 'should store image matadata'
        it 'should store gm image instance'
        it 'should return image metadata'
        it 'should return exif data if returnExif is set to true'

      describe '#resize()', ->
        it 'should return updated properties for original image'
        it 'should return updated properties for resized image'
        it 'should write resized image to temp destination'
        it 'should set hegith and width for reszied image'
        it 'should set corret orientation for resized image'
        it 'should set colorspace to RGB for resized image'
        it 'should set quality for resized image'

      describe '#upload()', ->
        it 'should not upload original image if keepOriginal is set to false'
        it 'should set object Key to correct location on AWS S3'
        it 'should set ojbect ACL to specified ACL'
        it 'should set object ACL to default if not specified'
        it 'should set object Body to version src file'
        it 'should set object ContentType according to version type'
        it 'should set object Metadata from default metadata'
        it 'should set object Metadata from upload metadata'
        it 'should return updated version object on successfull upload'

      describe '#resizeAndUpload()', ->
        it 'should set version suffix if not provided'
        it 'should resize and upload according to image version'

      describe '#exec()', ->
        it 'should get source image metadata'
        it 'should make a copy of master version objects array'
        it 'should resize and upload original image accroding to versions'

    it 'should upload image to new random path'

