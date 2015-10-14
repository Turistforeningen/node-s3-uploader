fs        = require('fs')
extname   = require('path').extname

S3        = require('aws-sdk').S3

auto      = require('async').auto
each      = require('async').each
map       = require('async').map
retry     = require('async').retry

resize    = require 'im-resize'
metadata  = require 'im-metadata'

Upload = module.exports = (bucketName, @opts = {}) ->
  throw new TypeError 'Bucket name can not be undefined' if not bucketName

  @opts.aws                     ?= {}
  #@opts.aws.accessKeyId
  @opts.aws.acl                 ?= 'private'
  @opts.aws.httpOptions         ?= {}
  @opts.aws.httpOptions.timeout ?= 10000
  @opts.aws.maxRetries          ?= 3
  @opts.aws.params              ?= {}
  @opts.aws.params.Bucket       = bucketName
  @opts.aws.path                ?= ''
  @opts.aws.region              ?= 'us-east-1'
  #@opts.aws.secretAccessKey
  @opts.aws.sslEnabled          ?= true

  @opts.cleanup                 ?= {}
  @opts.returnExif              ?= false

  @opts.resize                  ?= {}
  #@opts.resize.path
  #@opts.resize.prefix
  @opts.resize.quality          ?= 70
  @opts.versions                ?= []

  if not @opts.url and @opts.aws.region is 'us-east-1'
    @opts.url ?= "https://s3.amazonaws.com/#{bucketName}/"
  else if not @opts.url
    @opts.url ?= "https://s3-#{@opts.aws.region}.amazonaws.com/#{bucketName}/"

  @._getRandomPath = @opts.randomPath or require('@starefossen/rand-path')

  @s3 = new S3 @opts.aws

  @

##
# Generate a random avaiable path on the S3 bucket
##
Upload.prototype._getDestPath = (prefix, callback) ->
  retry 5, (cb) =>
    path = prefix + @_getRandomPath()
    @s3.listObjects Prefix: path, (err, data) ->
      return cb err if err
      return cb null, path if data.Contents.length is 0
      return cb new Error "Path #{path} not avaiable"
  , callback

##
# Upload a new image to the S3 bucket
##
Upload.prototype.upload = (src, opts, cb) ->
  image = new Image src, opts, @
  image.start(cb)

##
# Image upload
##
Image = module.exports.Image = (@src, @opts, @upload) ->
  @

Image.prototype.start = (cb) ->
  auto
    metadata: @getMetadata.bind(@, @src)
    dest: @getDest.bind(@)
    versions: ['metadata', @resizeVersions.bind(@)]
    uploads: ['versions', 'dest', @uploadVersions.bind(@)]
    cleanup: ['uploads', @removeVersions.bind(@)]
  , (err, results) ->
    cb err, results.uploads, results.metadata

##
# Get image metadata
##
Image.prototype.getMetadata = (src, cb) ->
  metadata src, exif: @upload.opts.returnExif, autoOrient: true, cb

##
# Get image destination
##
Image.prototype.getDest = (cb) ->
  prefix = @opts?.awsPath or @upload.opts.aws.path

  if @opts.path
    return process.nextTick =>
      cb null, prefix + @opts.path

  @upload._getDestPath prefix, cb

##
# Resize image
##
Image.prototype.resizeVersions = (cb, results) ->
  resize results.metadata,
    path: @upload.opts.resize.path
    prefix: @upload.opts.resize.prefix
    quality: @upload.opts.resize.quality
    versions: JSON.parse JSON.stringify @upload.opts.versions
  , cb

##
# Upload resized versions
##
Image.prototype.uploadVersions = (cb, results) ->
  if @upload.opts.original
    org = JSON.parse(JSON.stringify(@upload.opts.original))
    org.original  = true
    org.width     = results.metadata.width
    org.height    = results.metadata.height
    org.path      = @src

    results.versions.push org

  map results.versions, @_upload.bind(@, results.dest), cb

##
# Clean up local copies
##
Image.prototype.removeVersions = (cb, results) ->
  each results.uploads, (image, callback) =>
    if not @upload.opts.cleanup.original and image.original \
    or not @upload.opts.cleanup.versions and not image.original
      return setTimeout callback, 0

    fs.unlink image.path, callback
  , (err) ->
    cb()

##
# Upload image version to S3
##
Image.prototype._upload = (dest, version, cb) ->
  version.awsImageAcl ?= @upload.opts.aws.acl
  format = extname(version.path).substr(1).toLowerCase()

  options =
    Key: "#{dest}#{version.suffix or ''}.#{format}"
    ACL: version.awsImageAcl
    Body: fs.createReadStream version.path
    ContentType: "image/#{if format is 'jpg' then 'jpeg' else format}"

  if version.awsImageExpires
    options.Expires = new Date(Date.now() + version.awsImageExpires)

  if version.awsImageMaxAge
    options.CacheControl = "public, max-age=#{version.awsImageMaxAge}"

  @upload.s3.putObject options, (err, data) =>
    return cb err if err

    version.etag = data.ETag
    version.key = options.Key
    version.url = @upload.opts.url + options.Key if @upload.opts.url

    cb null, version
