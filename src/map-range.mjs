// Metre to map-SVG coordinate conversion, independent of selected world.
export function mapRadius(metres,worldSize,svgWidth=800){
 if(!Number.isFinite(metres)||metres<0||!Number.isFinite(worldSize)||worldSize<=0)return null;
 return metres/worldSize*svgWidth;
}
export function insideMinimum(distance,minimum){
 return Number.isFinite(distance)&&Number.isFinite(minimum)&&minimum>0&&distance<minimum;
}
