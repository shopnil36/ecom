import { identity } from '../../../lib/auth';
export async function GET(){const user=await identity();return Response.json({admin:user.isAdmin},{headers:{'Cache-Control':'no-store'}});}
