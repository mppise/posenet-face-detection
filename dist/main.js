/******/ (() => { // webpackBootstrap
// import * as tf from "@tensorflow/tfjs";
// import * as posenet from "@tensorflow-models/posenet";

/**
 * Detects multiple faces from an image. Pass optional parameters to control accuracy and maximum number of faces.
 * @param {ImageData} imageDataURL Image
 * @param {Object} options  Optional parameters 
 * @param {number} options.accuracy Filters and returns faces above specified accuracy. Must b between 0 and 1 (default: 0.2, i.e. 20%)
 * @param {number} options.maxFaces Returns a maximum of specified number of faces. Faces returned based on highest accuracy. (default: 10)
 * @returns {Promise} Promise contains an array of ImageData along with score. 
 */
function detectFaces(imageDataURL, options) {
  // -- Default options -- //
  var opts = {
    "accuracy": 0.2,
    "maxFaces": 10
  };

  if (options) {
    if (Object.keys(options).indexOf('accuracy') > -1) opts.accuracy = options['accuracy'] >= 0 && options['accuracy'] < 1 ? options['accuracy'] : opts.accuracy;
    if (Object.keys(options).indexOf('maxFaces') > -1) opts.maxFaces = options['maxFaces'] >= 0 ? options['maxFaces'] : opts.maxFaces;
  }

  return new Promise(function (resolve, reject) {
    var imgDOM = document.createElement("img");
    imgDOM.setAttribute("src", imageDataURL.toString());
    var portrait = imgDOM.height > imgDOM.width ? true : false; // Copy image to canvas

    var canvDOM = document.createElement("canvas");
    canvDOM.setAttribute('width', imgDOM.width.toString());
    canvDOM.setAttribute('height', imgDOM.height.toString());
    canvDOM.getContext('2d').drawImage(imgDOM, 0, 0);
    var faces = []; // Load PoseNet

    tf.tidy(function () {
      posenet.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        inputResolution: {
          width: portrait ? 600 : 800,
          height: portrait ? 800 : 600
        }
      }).then(function (model) {
        model.estimateMultiplePoses(imgDOM, {
          flipHorizontal: false,
          maxDetections: options.maxFaces
        }).then(function (results) {
          results = results.sort(function (a, b) {
            return b.score - a.score;
          });
          results.forEach(function (result) {
            if (result.score > options.accuracy) {
              // Find face and crop
              var nose;
              var earLeft;
              var earRight;
              var eyeLeft;
              var eyeRight;
              result.keypoints.forEach(function (element) {
                if (element.part == "nose") nose = element.position;
                if (element.part == "leftEar") earLeft = element.position;
                if (element.part == "rightEar") earRight = element.position;
                if (element.part == "leftEye") eyeLeft = element.position;
                if (element.part == "rightEye") eyeRight = element.position;
              });
              var center = nose;
              var offcenter = 1 + (earLeft.x - earRight.x) / 2 / center.x;
              var earToEar = (earLeft.x - earRight.x) * offcenter;
              var xTop = center.x - earToEar / 2;
              var yTop = center.y - earToEar / 2;
              var croppedImage = canvDOM.getContext('2d').getImageData(xTop, yTop, earToEar, earToEar); // Create Canvas DOM for cropped image

              var cropCanvDOM = document.createElement("canvas");
              cropCanvDOM.setAttribute('width', earToEar.toString());
              cropCanvDOM.setAttribute('height', earToEar.toString());
              cropCanvDOM.getContext('2d').putImageData(croppedImage, 0, 0); // Collect faces as Image Data URLs

              faces.push({
                score: result.score,
                imgURL: cropCanvDOM.toDataURL()
              });
              cropCanvDOM.remove();
            }
          });
          resolve(faces);
        }).catch(function (err) {
          return reject(err);
        });
      }).catch(function (err) {
        return reject(err);
      });
    }); // tidy
  }); // promise
} // detectFaces
/******/ })()
;