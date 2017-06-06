'use strict';
const path = require('path')
const fs = require('fs')
const aws = require("aws-sdk")
const sharp = require('sharp')
const request = require('request')
const timestamp = parseInt(new Date()*1000)
const imageFile = `/tmp/image-${timestamp}`
const thumbFile = `/tmp/thumb-${timestamp}`

exports.handler = (event, context, callback) => {
  request({method: 'GET', url: event.url, encoding: null}, (error, response, body) => {
    if(!error && response.statusCode === 200){
      fs.writeFile(imageFile, body, 'binary', (error) => {
        if(error){
          const resp = {state: "failure", message: `write error: ${error}`}
          callback(error, resp);
          return
        }
        const content_type = response.headers['content-type']
        sharp.cache(false)
        const image = sharp(imageFile)
        image.metadata( (err, metadata) => {
          image.resize(200, 200).max().toFile(thumbFile, (error, info) => {
            if (error) {
              const resp = {state: "failure", message: `resize error: ${error}`}
              callback(error, resp);
              return
            }
            console.log(info)
            const format = info.format
            const params = {
              Bucket: event.bucket,
              Key: `images/images/${event.id}.${format}`,
              Body: fs.createReadStream(imageFile),
              ContentType: content_type,
              CacheControl: "max-age=86400",
              ACL: "public-read",
            }
            new aws.S3().upload(params, (error, data) => {
              if (error) {
                const resp = {state: "failure", message: `image upload error: ${error}`}
                callback(error, resp);
                return
              }
              const params = {
                Bucket: event.bucket,
                Key: `images/thumbnails/${event.id}.${format}`,
                Body: fs.createReadStream(thumbFile),
                ContentType: content_type,
                CacheControl: "max-age=86400",
                ACL: "public-read",
              }
              new aws.S3().upload(params, (error, data) => {
                if (error) {
                  const resp = {state: "failure", message: `thumbnail upload error: ${error}`}
                  callback(error, resp);
                } else {
                  const resp = {
                    state: "success",
                    image: `images/images/${event.id}.${format}`,
                    thumbnail: `images/thumbnails/${event.id}.${format}`,
                    width: metadata.width,
                    height: metadata.height,
                  }
                  callback(error, resp);
                }
              })
            })
          })
        })
      })
    }else{
      const resp = {state: "failure", message: `get image error: ${error}`}
      callback(error, resp)
    }
  })
};
