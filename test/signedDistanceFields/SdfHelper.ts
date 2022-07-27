import { Vector3 } from "@babylonjs/core"
import { SignedDistanceField } from "./SignedDistanceField"
import { Chunk } from "../";

/**
 * sample a field along x and y where z = 0
 * @param height 
 * @param width 
 * @param step 
 * @param field 
 * @returns 
 */
function SampleFieldXy(height: number, width: number,step: number, field: SignedDistanceField): number[][] {
    const sample: number[][] = [];
    const point = new Vector3(0,0,0);
    for (let i = 0; i <= width / step; i++) {
        sample[i] = [];
        for (let j = 0; j <= height / step; j++) {
            const x = i * step;
            const y = j * step;
            point.set(x - (width / 2), y - (height / 2), 0);
            const distance = field.sample(point);
            sample[i][j] = distance;
        }
    }
    return sample;
}

/**
 * sample a field along x and y where z = 0
 * @param depth 
 * @param width 
 * @param step 
 * @param field 
 * @returns 
 */
 function SampleFieldXz(depth: number, width: number,step: number, field: SignedDistanceField): number[][] {
    const sample: number[][] = [];
    const point = new Vector3(0,0,0);
    for (let i = 0; i <= width / step; i++) {
        sample[i] = [];
        for (let j = 0; j <= depth / step; j++) {
            const x = i * step;
            const z = j * step;
            point.set(x - (width / 2),0, z - (depth / 2));
            const distance = field.sample(point);
            sample[i][j] = distance;
        }
    }
    return sample;
}

/**
 * shows a signed distance field as a formated number string
 * @param samples 
 * @returns 
 */
function NumScale(samples: number[][]): string {
    let result = '';
    const yMaxIndex = samples[0].length - 1;
    for (let x = 0; x < samples.length; x++) {
        result += '\n';
        for (let y = 0; y < samples[x].length; y++) {
            const value = samples[x][yMaxIndex - y];
            let formattedValue = value.toFixed(0);
            if (formattedValue.length == 1)
                formattedValue = '0' + formattedValue;            
            if (value < 0 && formattedValue.length == 2)
                formattedValue = formattedValue.replace('-','-0');
            if (value >= 0)
                formattedValue = '+' + formattedValue;
            result += '  ' + formattedValue;
        }
    }
    return result;
}

/**
 * Creates a 'GreyScale' ascii string of a signed distance field
 * @param samples 
 * @param start 
 * @param end 
 * @returns 
 */
function GreyScale(samples: number[][],start: number, end: number): string {
    let result = '';
    const range = end - start;
    const min = Math.min(start,end);
    const yMaxIndex = samples[0].length - 1;
    for (let x = 0; x < samples.length; x++) {
        result += '\n|';
        for (let y = 0; y < samples[x].length; y++) {
            const value = samples[x][yMaxIndex - y];
            const grey = GreyChar(value, min, range);
            // double up horizontally as characters are rectangular
            result += grey + grey;
        }
        result += '|';
    }
    return result;
}

function GreyChar(value: number, min: number, range: number) {
    const greyScale = '@%#*+=-:,. ';
    let pos = Math.floor(((value - min) / range) * greyScale.length);
    if (pos < 0)
        pos = 0;
    if (pos >= greyScale.length)
        pos = greyScale.length - 1;
    const grey = greyScale[Math.abs(pos)];
    return grey;
}

/**
 * trim spaces off each line of a multiline string
 * @param text 
 * @returns 
 */
function Trim (text: string): string {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        lines[i] = lines[i].trim();
    }
    return '\n' + lines.join('\n');
}


export { NumScale, GreyScale, SampleFieldXy, SampleFieldXz, Trim }