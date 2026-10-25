/** Source intrinsics are declared assumptions, not measured camera metadata. */
export function validateCameraAssumption(input) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('A declared pinhole camera assumption is required');
 const {verticalFovDegrees,imageAspect}=input;
 if((input.kind!==undefined&&input.kind!=='assumed-pinhole')||
    (input.principalPoint!==undefined&&(!Array.isArray(input.principalPoint)||input.principalPoint.length!==2||input.principalPoint[0]!==.5||input.principalPoint[1]!==.5)))
   throw new Error('Unsupported camera model or principal point');
 if(!Number.isFinite(verticalFovDegrees)||verticalFovDegrees<15||verticalFovDegrees>110 ||
    !Number.isFinite(imageAspect)||imageAspect<.2||imageAspect>8)
   throw new Error('Camera FOV or image aspect is outside supported limits');
 return {kind:'assumed-pinhole',verticalFovDegrees,imageAspect,principalPoint:[.5,.5]};
}
