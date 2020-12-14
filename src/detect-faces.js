import * as tf from "@tensorflow/tfjs";
import * as posenet from "@tensorflow-models/posenet";

/**
 * Detects multiple faces from an image. Pass optional parameters to control accuracy and maximum number of faces.
 * @param {ImageData} imageDataURL Image
 * @param {Object} options  Optional parameters 
 * @param {number} options.accuracy Filters and returns faces above specified accuracy. Must b between 0 and 1 (default: 0.2, i.e. 20%)
 * @param {number} options.maxFaces Returns a maximum of specified number of faces. Faces returned based on highest accuracy. (default: 10)
 * @returns {Promise} Promise contains an array of ImageData along with score. 
 */
exports.detectFaces = (imageDataURL, options) => {
    // -- Default options -- //
    let opts = {
        "accuracy": 0.2,
        "maxFaces": 10
    };
    if (options) {
        if (Object.keys(options).indexOf('accuracy') > -1)
            opts.accuracy = (options['accuracy'] >= 0 && options['accuracy'] < 1) ? options['accuracy'] : opts.accuracy;
        if (Object.keys(options).indexOf('maxFaces') > -1)
            opts.maxFaces = options['maxFaces'] >= 0 ? options['maxFaces'] : opts.maxFaces;
    }

    return new Promise((resolve, reject) => {
        let imgDOM = document.createElement("img");
        imgDOM.setAttribute("src", imageDataURL.toString());
        let portrait = imgDOM.height > imgDOM.width ? true : false;

        // Copy image to canvas
        let canvDOM = document.createElement("canvas");
        canvDOM.setAttribute('width', imgDOM.width.toString());
        canvDOM.setAttribute('height', imgDOM.height.toString());
        canvDOM.getContext('2d').drawImage(imgDOM, 0, 0);

        let faces = [];
        // Load PoseNet
        tf.tidy(() => {
            posenet.load({
                architecture: 'MobileNetV1',
                outputStride: 16,
                inputResolution: { width: portrait ? 600 : 800, height: portrait ? 800 : 600 }
            }).then((model) => {
                model.estimateMultiplePoses(imgDOM, { flipHorizontal: false, maxDetections: options.maxFaces })
                    .then((results) => {
                        results = results.sort((a, b) => (b.score - a.score));
                        results.forEach((result) => {
                            if (result.score > options.accuracy) {
                                // Find face and crop
                                let nose;
                                let earLeft;
                                let earRight;
                                let eyeLeft;
                                let eyeRight;
                                result.keypoints.forEach((element) => {
                                    if (element.part == "nose")
                                        nose = element.position;
                                    if (element.part == "leftEar")
                                        earLeft = element.position;
                                    if (element.part == "rightEar")
                                        earRight = element.position;
                                    if (element.part == "leftEye")
                                        eyeLeft = element.position;
                                    if (element.part == "rightEye")
                                        eyeRight = element.position;
                                });
                                let center = nose;
                                let offcenter = 1 + (((earLeft.x - earRight.x) / 2) / center.x);
                                let earToEar = (earLeft.x - earRight.x) * offcenter;
                                let xTop = center.x - (earToEar / 2);
                                let yTop = center.y - (earToEar / 2);

                                let croppedImage = canvDOM.getContext('2d').getImageData(xTop, yTop, earToEar, earToEar);

                                // Create Canvas DOM for cropped image
                                let cropCanvDOM = document.createElement("canvas");
                                cropCanvDOM.setAttribute('width', earToEar.toString());
                                cropCanvDOM.setAttribute('height', earToEar.toString());
                                cropCanvDOM.getContext('2d').putImageData(croppedImage, 0, 0);

                                // Collect faces as Image Data URLs
                                faces.push({ score: result.score, imgURL: cropCanvDOM.toDataURL() });
                                cropCanvDOM.remove();
                            }
                        });
                        resolve(faces);
                    }).catch((err) => reject(err));
            }).catch((err) => reject(err));
        }); // tidy
    }); // promise
} // detectFaces
