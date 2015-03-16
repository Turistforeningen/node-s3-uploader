assert = require 'assert'
Upload = require '../src/index.coffee'

fs = require('fs')
gm = require('gm').subClass imageMagick: true

hash = require('crypto').createHash
rand = require('crypto').pseudoRandomBytes

upload = listObjects = putObject = null
cleanup = []

SIZE = if process.env.DRONE or process.env.CI then 'KBB' else 'KB'
COLOR = if process.env.DRONE or process.env.CI then 'RGB' else 'sRGB'

beforeEach ->
  upload = new Upload process.env.AWS_BUCKET_NAME,
    aws:
      path: process.env.AWS_BUCKET_PATH
      region: process.env.AWS_BUCKET_REGION
      acl: 'public-read'
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
    upload.s3.listObjects = (path, cb) ->
      process.nextTick -> cb null, Contents: []

    upload.s3.putObject = (opts, cb) ->
      process.nextTick -> cb null, ETag: '"' + hash('md5').update(rand(32)).digest('hex') + '"'

# Clean up S3 objects
if process.env.INTEGRATION_TEST is 'true'
  afterEach (done) ->
    @timeout 40000

    return process.nextTick done if cleanup.length is 0

    upload.s3.deleteObjects Delete: Objects: cleanup, (err) ->
      throw err if err
      cleanup = []
      done()

describe 'Upload', ->
  describe 'constructor', ->
    it 'should throw error for missing awsBucketName param', ->
      assert.throws ->
        new Upload()
      , /Bucket name can not be undefined/

    it 'should set default values if not provided', ->
      upload = new Upload 'myBucket'

      assert upload.s3 instanceof require('aws-sdk').S3

      assert.equal upload.opts.aws.region, 'us-east-1'
      assert.equal upload.opts.aws.path, ''
      assert.equal upload.opts.aws.acl, 'privat'
      assert.equal upload.opts.aws.maxRetries, 3
      assert.equal upload.opts.aws.httpOptions.timeout, 10000

      assert upload.opts.versions instanceof Array
      assert.equal upload.opts.resizeQuality, 70
      assert.equal upload.opts.returnExif, false

      assert.equal upload.opts.tmpDir, '/tmp/'
      assert.equal upload.opts.tmpPrefix, 'gm-'

      assert.equal upload.opts.workers, 1
      assert.equal upload.opts.url, 'https://s3-us-east-1.amazonaws.com/myBucket/'

    it 'should set deprecated options correctly', ->
      upload = new Upload 'myBucket',
        awsBucketRegion: 'my-region'
        awsBucketPath: '/some/path'
        awsBucketAcl: 'some-acl'
        awsMaxRetries: 24
        awsHttpTimeout: 1337
        awsAccessKeyId: 'public'
        awsSecretAccessKey: 'secret'

      assert.equal upload.opts.aws.region, 'my-region'
      assert.equal upload.opts.aws.path, '/some/path'
      assert.equal upload.opts.aws.acl, 'some-acl'
      assert.equal upload.opts.aws.maxRetries, 24
      assert.equal upload.opts.aws.httpOptions.timeout, 1337
      assert.equal upload.opts.aws.accessKeyId, 'public'
      assert.equal upload.opts.aws.secretAccessKey, 'secret'

    it 'should set custom url', ->
      upload = new Upload 'myBucket', url: 'http://cdn.app.com/'
      assert.equal upload.opts.url, 'http://cdn.app.com/'

    it 'should override default values'

    it 'should connect to AWS S3 using environment variables', (done) ->
      @timeout 10000

      upload = new Upload process.env.AWS_BUCKET_NAME

      upload.s3.headBucket Bucket: process.env.AWS_BUCKET_NAME, (err, data) ->
        assert.ifError err
        done()

    it 'should connect to AWS S3 using constructor options', (done) ->
      @timeout 10000

      upload = new Upload process.env.AWS_BUCKET_NAME, aws:
        accessKeyId: process.env.AWS_ACCESS_KEY_ID
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY

      upload.s3.headBucket Bucket: process.env.AWS_BUCKET_NAME, (err, data) ->
        assert.ifError err
        done()

  describe '#_getRandomPath()', ->
    it 'should return a new random path', ->
      path = upload._getRandomPath()
      assert(/^[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path))

  describe '#_uploadPathIsAvailable()', ->
    it 'should return true for avaiable path', (done) ->
      upload.s3.listObjects = (opts, cb) -> process.nextTick -> cb null, Contents: []
      upload._uploadPathIsAvailable 'some/path/', (err, path, isAvaiable) ->
        assert.ifError err
        assert.equal isAvaiable, true
        done()

    it 'should return false for unavaiable path', (done) ->
      upload.s3.listObjects = (opts, cb) -> process.nextTick -> cb null, Contents: [opts.Prefix]
      upload._uploadPathIsAvailable 'some/path/', (err, path, isAvaiable) ->
        assert.ifError err
        assert.equal isAvaiable, false
        done()

  describe '#_uploadGeneratePath()', ->
    it 'should return an error if path is taken', (done) ->
      upload._uploadPathIsAvailable = (path, cb) -> process.nextTick -> cb null, path, false
      upload._uploadGeneratePath 'some/path/', (err, path) ->
        assert /Path '[^']+' not avaiable!/.test err
        done()

    it 'should return an avaiable path', (done) ->
      upload._uploadPathIsAvailable = (path, cb) -> process.nextTick -> cb null, path, true
      upload._uploadGeneratePath 'some/path/', (err, path) ->
        assert.ifError err
        assert /^some\/path\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}\/[A-Za-z0-9]{2}$/.test(path)
        done()

  describe '#upload()', ->
    it 'should use default aws path', (done) ->
      upload._uploadGeneratePath = (prefix, cb) ->
        assert.equal prefix, upload.opts.aws.path
        done()

      upload.upload 'dummy.jpg', {}

    it 'should override default aws path', (done) ->
      upload._uploadGeneratePath = (prefix, cb) ->
        assert.equal prefix, '/my/new/path'
        done()

      upload.upload 'dummy.jpg', awsPath: '/my/new/path'

describe 'Image', ->
  image = null

  beforeEach ->
    src = __dirname + '/assets/photo.jpg'
    dest = 'images_test/Wm/PH/f3/I0'
    opts = {}

    image = new Upload.Image src, dest, opts, upload

  describe 'constructor', ->
    it 'should set default values', ->
      assert image instanceof Upload.Image
      assert image.config instanceof Upload
      assert.equal image.src, __dirname + '/assets/photo.jpg'
      assert.equal image.dest, 'images_test/Wm/PH/f3/I0'
      assert /[a-z0-9]{24}/.test image.tmpName
      assert.deepEqual image.meta, {}
      assert.equal typeof image.gm, 'object'

  describe '#getMeta()', ->
    it 'should return image metadata', (done) ->
      @timeout 10000
      image.getMeta (err, meta) ->
        assert.ifError err
        assert.equal meta.format, 'jpeg'
        assert.equal meta.fileSize, '617' + SIZE
        assert.equal meta.imageSize.width, 1536
        assert.equal meta.imageSize.height, 2048
        assert.equal meta.orientation, 'Undefined'
        assert.equal meta.colorSpace, COLOR
        assert.equal meta.compression, 'JPEG'
        assert.equal meta.quallity, '96'
        assert.equal meta.exif, undefined
        done()

    it 'should store image matadata', (done) ->
      @timeout 10000
      image.getMeta (err) ->
        assert.ifError err
        assert.equal image.meta.format, 'jpeg'
        assert.equal image.meta.fileSize, '617' + SIZE
        assert.equal image.meta.imageSize.width, 1536
        assert.equal image.meta.imageSize.height, 2048
        assert.equal image.meta.orientation, 'Undefined'
        assert.equal image.meta.colorSpace, COLOR
        assert.equal image.meta.compression, 'JPEG'
        assert.equal image.meta.quallity, '96'
        assert.equal image.meta.exif, undefined
        done()

    it 'should return exif data if returnExif is set to true', (done) ->
      @timeout 10000
      image.config.opts.returnExif = true
      image.getMeta (err) ->
        assert.ifError err
        assert.equal typeof image.meta.exif, 'object'
        done()

    it 'should store gm image instance', (done) ->
      @timeout 10000
      image.getMeta (err) ->
        assert.ifError err
        assert image.gm instanceof require('gm')
        done()

  describe '#resize()', ->
    versions = null
    beforeEach ->
      versions = JSON.parse JSON.stringify upload.opts.versions
      versions[0].suffix = ''

      image.src = __dirname + '/assets/photo.jpg'
      image.gm = gm image.src
      image.tmpName = 'ed8d8b72071e731dc9065095c92c3e384d7c1e27'
      image.meta =
        format: 'jpeg'
        fileSize: '617' + SIZE
        imageSize: width: 1536, height: 2048
        orientation: 'Undefined'
        colorSpace: 'RGB'
        compression: 'JPEG'
        quallity: '96'
        exif: undefined

    it 'should return updated properties for original image', (done) ->
      @timeout 10000
      image.resize JSON.parse(JSON.stringify(versions[0])), (err, version) ->
        assert.ifError err
        assert.deepEqual version,
          original: true,
          awsImageAcl: 'private'
          suffix: ''
          src: image.src
          format: image.meta.format
          size: image.meta.fileSize
          width: image.meta.imageSize.width
          height: image.meta.imageSize.height
        done()

    it 'should throw error when version original is false', ->
      assert.throws ->
        image.resize original: false
      , '/version.original can not be false/'

    it 'should return updated properties for resized image', (done) ->
      @timeout 10000
      image.resize JSON.parse(JSON.stringify(versions[1])), (err, version) ->
        assert.ifError err
        assert.deepEqual version,
          suffix: versions[1].suffix
          quality: versions[1].quality
          format: 'jpeg'
          src: '/tmp/gm-ed8d8b72071e731dc9065095c92c3e384d7c1e27-large.jpeg'
          width: versions[1].maxWidth
          height: versions[1].maxHeight

        done()

    it 'should write resized image to temp destination', (done) ->
      @timeout 10000
      image.resize JSON.parse(JSON.stringify(versions[1])), (err, version) ->
        assert.ifError err
        fs.stat version.src, (err, stat) ->
          assert.ifError err
          assert.equal typeof stat, 'object'
          done()

    it 'should set hegith and width for reszied image', (done) ->
      @timeout 10000
      image.resize JSON.parse(JSON.stringify(versions[1])), (err, version) ->
        assert.ifError err
        gm(version.src).size (err, value) ->
          assert.ifError err
          assert.deepEqual value,
            width: 780
            height: 1040
          done()

    it 'should set correct orientation for resized image', (done) ->
      @timeout 10000
      image.src = __dirname + '/assets/rotate.jpg'
      image.gm = gm image.src
      image.meta.orientation = 'TopLeft'
      image.resize JSON.parse(JSON.stringify(versions[1])), (err, version) ->
        assert.ifError err
        gm(version.src).identify (err, value) ->
          assert.ifError err
          assert.equal value.Orientation, 'Undefined'
          assert.equal value.size.width, 585
          assert.equal value.size.height, 1040
          done()

    it 'should set colorspace to RGB for resized image', (done) ->
      @timeout 10000
      image.src = __dirname + '/assets/cmyk.jpg'
      image.gm = gm image.src
      image.meta.colorSpace = 'CMYK'
      image.resize JSON.parse(JSON.stringify(versions[1])), (err, version) ->
        assert.ifError err
        gm(version.src).identify (err, value) ->
          assert.ifError err
          assert.equal value.Colorspace, COLOR
          done()

    it 'should set quality for resized image', (done) ->
      @timeout 10000
      versions[1].quality = 50
      image.src = __dirname + '/assets/photo.jpg'
      image.gm = gm image.src
      image.resize JSON.parse(JSON.stringify(versions[1])), (err, version) ->
        assert.ifError err
        gm(version.src).identify (err, value) ->
          assert.ifError err
          assert.equal value.Quality, versions[1].quality
          done()

  describe '#upload()', ->
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

describe 'Integration Tests', ->
  it 'should upload image to new random path', (done) ->
    @timeout 40000
    upload.upload __dirname + '/assets/photo.jpg', {}, (err, images, meta) ->
      assert.ifError err

      for image in images
        cleanup.push Key: image.path if image.path # clean up in AWS

        if image.original
          assert.equal typeof image.size, 'string'

        assert.equal typeof image.src, 'string'
        assert.equal typeof image.format, 'string'
        assert.equal typeof image.width, 'number'
        assert.equal typeof image.height, 'number'
        assert /[0-9a-f]{32}/.test image.etag
        assert.equal typeof image.path, 'string'
        assert.equal typeof image.url, 'string'

      done()

  it 'should not upload original if not in versions array', (done) ->
    @timeout 40000
    upload.opts.versions.shift()
    upload.upload __dirname + '/assets/photo.jpg', {}, (err, images, meta) ->
      assert.ifError err

      for image in images
        cleanup.push Key: image.path if image.path # clean up in AWS

        assert.equal typeof image.original, 'undefined'
        assert.equal typeof image.src, 'string'
        assert.equal typeof image.format, 'string'
        assert.equal typeof image.width, 'number'
        assert.equal typeof image.height, 'number'
        assert /[0-9a-f]{32}/.test image.etag
        assert.equal typeof image.path, 'string'
        assert.equal typeof image.url, 'string'

      done()

