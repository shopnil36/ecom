import { handle } from '../../../lib/commerce';
async function route(req:Request,ctx:any){const {path}=await ctx.params;return handle(req,path);}
export {route as GET,route as POST,route as PUT};
