import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces';

const inter = loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });
const fraunces = loadFraunces('normal', { weights: ['400', '600', '700'], subsets: ['latin'] });

export const fontSans = inter.fontFamily;
export const fontDisplay = fraunces.fontFamily;
