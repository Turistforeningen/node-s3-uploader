S3 = require('aws-sdk').S3
fs = require 'fs'
gm = require('gm').subClass imageMagick: true
async = require 'async'

hash = require('crypto').createHash
rand = require('crypto').pseudoRandomBytes

Upload = module.exports = (awsBucketName, opts) ->
  throw new Error 'Bucket name can not be undefined' if not awsBucketName

  @s3 = new S3 params: Bucket: awsBucketName

  @versions = opts?.versions or []

  @awsBucketPath = opts?.awsBucketPath or ''
  @awsBucketUrl = opts?.awsBucketUrl
  @awsBucketAcl = opts?.awsBucketAcl or 'privat'
  @resizeQuality = opts?.resizeQuality or 70
  @returnExif = opts?.returnExif or false
  @tmpDir = (opts?.tmpDir or require('os').tmpdir()) + '/'
  @tmpPrefix = 'gm-'

  @

Upload.prototype._getRandomPath = ->
  input = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  res = []

  for i in [1..3]
    x = input[Math.floor((Math.random() * input.length))]
    y = input[Math.floor((Math.random() * input.length))]
    res.push x + y

  return @awsBucketPath + res.join '/'

Upload.prototype._uploadPathIsAvailable = (path, callback) ->
  @s3.listObjects Prefix: path, (err, data) ->
    return callback err if err
    return callback null, path, data.Contents.length is 0

Upload.prototype._uploadGeneratePath = (callback) ->
  @._uploadPathIsAvailable this._getRandomPath(), (err, path, avaiable) ->
    return callback err if err
    return callback new Error "Path '#{path}' not avaiable!" if not avaiable
    return callback null, path

Upload.prototype.upload = (src, opts, cb) ->
  @_uploadGeneratePath (err, dest) =>
    return cb err if err
    new Image(src, dest, opts, @).exec cb

Image = Upload.Image = (src, dest, opts, config) ->
  @config = config

  @src  = src
  @dest = dest
  @tmpName = hash('sha1').update(rand(128)).digest('hex')

  @opts = opts or {}
  @returnExif = opts.returnExif or config.returnExif

  @meta = {}
  @gm = null

  @

Image.prototype.getMeta = (cb) ->
  @gm = gm(@src).identify (err, val) =>
    return cb err if err
    @meta =
      format: val.format.toLowerCase()
      fileSize: val.Filesize
      imageSize: val.size
      orientation: val.Orientation
      colorSpace: val.Colorspace
      compression: val.Compression
      quallity: val.Quality
      exif: val.Properties if @config.returnExif

    return cb null, @meta

Image.prototype.resize = (version, cb) ->
  if version.original
    version.src = @src
    version.format = @meta.format
    version.size = @meta.fileSize
    version.width = @meta.imageSize.width
    version.height = @meta.imageSize.height

    return process.nextTick -> cb null, version

  version.format = 'jpeg'
  version.src = [
    @config.tmpDir
    @config.tmpPrefix
    @tmpName
    version.suffix
    ".#{version.format}"
  ].join('')

  img = gm(@src)
    .resize(version.maxWidth, version.maxHeight)
    .quality(version.quality or @config.resizeQuality)
    .autoOrient()

  img.colorspace('RGB') if @meta.colorSpace isnt 'RGB'

  img.write version.src, (err) ->
      return cb err if err

      version.width = version.maxWidth; delete version.maxWidth
      version.height = version.maxHeight; delete version.maxHeight

      cb null, version

Image.prototype.upload = (version, cb) ->
  options =
    Key: @dest + version.suffix + '.' + version.format
    ACL: version.awsImageAcl or @config.awsBucketAcl
    Body: fs.createReadStream(version.src)
    ContentType: 'image/' + version.format
    Metadata: @opts.metadata or {}

  @config.s3.putObject options, (err, data) =>
    return cb err if err

    version.etag = data.ETag
    version.path = options.Key
    version.url = @config.awsBucketUrl + version.path if @config.awsBucketUrl

    delete version.awsImageAcl
    delete version.suffix

    cb null, version

Image.prototype.resizeAndUpload = (version, cb) ->
  version.suffix = version.suffix or ''

  @resize version, (err, version) =>
    return cb err if err
    @upload version, cb

Image.prototype.exec = (cb) ->
  @getMeta (err) =>
    return cb err if err
    versions = JSON.parse(JSON.stringify(@config.versions))
    async.mapLimit versions, 2, @resizeAndUpload.bind(@), (err, versions) =>
      return cb err if err
      return cb null, versions, @meta

