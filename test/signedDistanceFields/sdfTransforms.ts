

import { MakeSdfSphere,MakeSdfBox,MakeSdfCylinder,MakeSdfUnion } from ".."
import { SampleFieldXy, SampleFieldXz, GreyScale, NumScale, Trim } from "./SdfHelper"
import { Matrix, Vector3 } from "@babylonjs/core"

export function TestSdfTransforms() {
        
    describe('Transform SDF', () => {

        it('translates a sphere', () => {
            const field = MakeSdfSphere(45);
            field.setPosition(25,0,0);
            const samples = SampleFieldXy(100,100,5,field);
            const numField = NumScale(samples);
            expect(Trim(numField)).toEqual(Trim(`
                +45  +42  +40  +38  +36  +34  +33  +31  +31  +30  +30  +30  +31  +31  +33  +34  +36  +38  +40  +42  +45
                +41  +38  +36  +33  +31  +29  +28  +27  +26  +25  +25  +25  +26  +27  +28  +29  +31  +33  +36  +38  +41
                +37  +34  +31  +29  +27  +25  +23  +22  +21  +20  +20  +20  +21  +22  +23  +25  +27  +29  +31  +34  +37
                +33  +30  +27  +24  +22  +20  +18  +17  +16  +15  +15  +15  +16  +17  +18  +20  +22  +24  +27  +30  +33
                +29  +26  +23  +20  +18  +15  +14  +12  +11  +10  +10  +10  +11  +12  +14  +15  +18  +20  +23  +26  +29
                +26  +22  +19  +16  +13  +11  +09  +07  +06  +05  +05  +05  +06  +07  +09  +11  +13  +16  +19  +22  +26
                +22  +19  +15  +12  +09  +06  +04  +02  +01  +00  +00  +00  +01  +02  +04  +06  +09  +12  +15  +19  +22
                +19  +15  +12  +08  +05  +02  -00  -02  -04  -05  -05  -05  -04  -02  -00  +02  +05  +08  +12  +15  +19
                +16  +12  +08  +04  +01  -02  -05  -07  -09  -10  -10  -10  -09  -07  -05  -02  +01  +04  +08  +12  +16
                +13  +09  +05  +01  -03  -06  -09  -11  -13  -15  -15  -15  -13  -11  -09  -06  -03  +01  +05  +09  +13
                +11  +06  +02  -02  -06  -10  -13  -16  -18  -20  -20  -20  -18  -16  -13  -10  -06  -02  +02  +06  +11
                +09  +04  -00  -05  -09  -13  -17  -20  -23  -24  -25  -24  -23  -20  -17  -13  -09  -05  -00  +04  +09
                +07  +02  -02  -07  -11  -16  -20  -24  -27  -29  -30  -29  -27  -24  -20  -16  -11  -07  -02  +02  +07
                +06  +01  -04  -09  -13  -18  -23  -27  -31  -34  -35  -34  -31  -27  -23  -18  -13  -09  -04  +01  +06
                +05  +00  -05  -10  -15  -20  -24  -29  -34  -38  -40  -38  -34  -29  -24  -20  -15  -10  -05  +00  +05
                +05  +00  -05  -10  -15  -20  -25  -30  -35  -40  -45  -40  -35  -30  -25  -20  -15  -10  -05  +00  +05
                +05  +00  -05  -10  -15  -20  -24  -29  -34  -38  -40  -38  -34  -29  -24  -20  -15  -10  -05  +00  +05
                +06  +01  -04  -09  -13  -18  -23  -27  -31  -34  -35  -34  -31  -27  -23  -18  -13  -09  -04  +01  +06
                +07  +02  -02  -07  -11  -16  -20  -24  -27  -29  -30  -29  -27  -24  -20  -16  -11  -07  -02  +02  +07
                +09  +04  -00  -05  -09  -13  -17  -20  -23  -24  -25  -24  -23  -20  -17  -13  -09  -05  -00  +04  +09
                +11  +06  +02  -02  -06  -10  -13  -16  -18  -20  -20  -20  -18  -16  -13  -10  -06  -02  +02  +06  +11`));
            const greyField = GreyScale(samples,0,25);
            expect(Trim(greyField)).toEqual(Trim(`
                |                                          |
                |                                          |
                |              ....,,,,,,....              |
                |        ..,,,,::----------::,,,,..        |
                |      ,,::--====++++++++++====--::,,      |
                |  ..,,::==++****##########****++==::,,..  |
                |..,,--==**##%%%%@@@@@@@@@@%%%%##**==--,,..|
                |,,--==**##@@@@@@@@@@@@@@@@@@@@@@##**==--,,|
                |::==**%%@@@@@@@@@@@@@@@@@@@@@@@@@@%%**==::|
                |==**##@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@##**==|
                |++##@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@##++|
                |**%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%**|
                |**%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%**|
                |##@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@##|
                |##@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@##|
                |##@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@##|
                |##@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@##|
                |##@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@##|
                |**%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%**|
                |**%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%**|
                |++##@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@##++|`));
        })

        it('rotates a box', () => {
            const field = MakeSdfBox(60,40,20);
            field.rotation = new Vector3(0,0,Math.PI / 3);
            const samples = SampleFieldXy(100,100,5,field);
            const numField = NumScale(samples);
            expect(Trim(numField)).toEqual(Trim(`
                +48  +46  +43  +41  +38  +36  +33  +31  +28  +26  +23  +21  +19  +18  +18  +20  +23  +26  +30  +34  +38
                +44  +41  +39  +36  +34  +31  +29  +26  +24  +21  +19  +16  +14  +13  +13  +16  +19  +23  +27  +31  +36
                +40  +37  +35  +32  +30  +27  +25  +22  +20  +17  +15  +12  +10  +08  +09  +12  +16  +20  +25  +29  +33
                +35  +33  +30  +28  +25  +23  +20  +18  +15  +13  +10  +08  +05  +03  +05  +09  +13  +18  +22  +26  +31
                +31  +28  +26  +23  +21  +18  +16  +13  +11  +08  +06  +03  +01  -02  +02  +07  +11  +15  +20  +24  +28
                +27  +24  +22  +19  +17  +14  +12  +09  +07  +04  +02  -01  -03  -05  -00  +04  +08  +13  +17  +21  +26
                +23  +20  +17  +15  +12  +10  +07  +05  +02  -00  -03  -05  -08  -07  -03  +02  +06  +10  +15  +19  +23
                +19  +16  +13  +10  +08  +05  +03  +00  -02  -05  -07  -10  -10  -10  -05  -01  +03  +08  +12  +16  +21
                +16  +12  +09  +06  +04  +01  -01  -04  -06  -09  -10  -10  -10  -10  -08  -03  +01  +05  +10  +14  +18
                +14  +09  +05  +02  -01  -03  -06  -08  -10  -10  -10  -10  -10  -10  -10  -06  -02  +03  +07  +11  +16
                +14  +09  +05  +00  -04  -08  -10  -10  -10  -10  -10  -10  -10  -10  -10  -08  -04  +00  +05  +09  +14
                +16  +11  +07  +03  -02  -06  -10  -10  -10  -10  -10  -10  -10  -08  -06  -03  -01  +02  +05  +09  +14
                +18  +14  +10  +05  +01  -03  -08  -10  -10  -10  -10  -09  -06  -04  -01  +01  +04  +06  +09  +12  +16
                +21  +16  +12  +08  +03  -01  -05  -10  -10  -10  -07  -05  -02  +00  +03  +05  +08  +10  +13  +16  +19
                +23  +19  +15  +10  +06  +02  -03  -07  -08  -05  -03  -00  +02  +05  +07  +10  +12  +15  +17  +20  +23
                +26  +21  +17  +13  +08  +04  -00  -05  -03  -01  +02  +04  +07  +09  +12  +14  +17  +19  +22  +24  +27
                +28  +24  +20  +15  +11  +07  +02  -02  +01  +03  +06  +08  +11  +13  +16  +18  +21  +23  +26  +28  +31
                +31  +26  +22  +18  +13  +09  +05  +03  +05  +08  +10  +13  +15  +18  +20  +23  +25  +28  +30  +33  +35
                +33  +29  +25  +20  +16  +12  +09  +08  +10  +12  +15  +17  +20  +22  +25  +27  +30  +32  +35  +37  +40
                +36  +31  +27  +23  +19  +16  +13  +13  +14  +16  +19  +21  +24  +26  +29  +31  +34  +36  +39  +41  +44
                +38  +34  +30  +26  +23  +20  +18  +18  +19  +21  +23  +26  +28  +31  +33  +36  +38  +41  +43  +46  +48`));
            const greyField = GreyScale(samples,0,25);
            expect(Trim(greyField)).toEqual(Trim(`
                |                      ..,,::::,,..        |
                |                  ..,,::--====--,,        |
                |              ..,,::--==++****==::,,      |
                |            ,,::--==++**##%%##++==::..    |
                |        ..,,::==++**##%%@@@@%%##++--,,    |
                |    ..,,::--==++##%%@@@@@@@@@@%%**==::..  |
                |..,,::--==++**##%%@@@@@@@@@@@@@@##++--,,  |
                |,,--==++**##%%@@@@@@@@@@@@@@@@@@%%**==::..|
                |::==**##%%@@@@@@@@@@@@@@@@@@@@@@@@##++--,,|
                |--++##@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%**==--|
                |--++##@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@##++--|
                |--==**%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@##++--|
                |,,--++##@@@@@@@@@@@@@@@@@@@@@@@@%%##**==::|
                |..::==**%%@@@@@@@@@@@@@@@@@@%%##**++==--,,|
                |  ,,--++##@@@@@@@@@@@@@@%%##**++==--::,,..|
                |  ..::==**%%@@@@@@@@@@%%##++==--::,,..    |
                |    ,,--++##%%@@@@%%##**++==::,,..        |
                |    ..::==++##%%##**++==--::,,            |
                |      ,,::==****++==--::,,..              |
                |        ,,--====--::,,..                  |
                |        ..,,::::,,..                      |`));
        })
    })

    it("should return a union of two SDFs", () => {
        const field1 = MakeSdfSphere(1.0);
        field1.setPosition(-1,0,0);
        const field2 = MakeSdfSphere(1.0);
        field2.setPosition(1,0,0);
        const union = MakeSdfUnion(field1, field2);
    
        const point1 = new Vector3(-1, 1, 0);
        const point2 = new Vector3(1, 1, 0);
        const point3 = new Vector3(0, 1, 0);
        const dist1 = union.sample(point1);
        const dist2 = union.sample(point2);
        const dist3 = union.sample(point3);
    
        expect(dist1).toBeCloseTo(0, 3);
        expect(dist2).toBeCloseTo(0, 3);
        expect(dist3).toBeCloseTo(0.414, 3);
      });
    
      it("should return a union of three SDFs", () => {
        const field1 = MakeSdfSphere(1.0);
        field1.setPosition(-1,0,0);
        const field2 = MakeSdfSphere(1.0);
        field2.setPosition(1,0,0);
        const field3 = MakeSdfSphere(1.0);
        field2.setPosition(0,0,0);
        const union = MakeSdfUnion(field1, field2, field3);
    
        const point1 = new Vector3(-1, 1, 0);
        const point2 = new Vector3(1, 1, 0);
        const point3 = new Vector3(0, 1, 0);
        const dist1 = union.sample(point1);
        const dist2 = union.sample(point2);
        const dist3 = union.sample(point3);
    
        expect(dist1).toBeCloseTo(0, 3);
        expect(dist2).toBeCloseTo(0, 3);
        expect(dist3).toBeCloseTo(0, 3);
      });
}