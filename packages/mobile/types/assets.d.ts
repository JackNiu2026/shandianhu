/**
 * 静态资源模块声明
 * 独立文件:不含任何 import/export,保持全局 ambient 声明,
 * 供 TopBar 等组件直接 import 图片资源。
 */
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.jpeg" {
  const src: string;
  export default src;
}
declare module "*.webp" {
  const src: string;
  export default src;
}
