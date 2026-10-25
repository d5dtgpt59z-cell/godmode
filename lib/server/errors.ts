export class ServiceError extends Error {
  constructor(public code:string,message:string,public status=400){super(message);this.name='ServiceError';}
}
/** Log structural diagnostics only: provider bodies, prompts and secret values never enter logs. */
export function logServerFailure(error:unknown){
  const incidentId=crypto.randomUUID();
  const item=error instanceof Error?error:new Error('Unknown thrown value');
  const causes:Error[]=[item];
  if(item.cause instanceof Error)causes.push(item.cause);
  const diagnostics=causes.map(cause=>{
    const missing=cause.message.match(/no such (table|column): ([a-zA-Z_][a-zA-Z0-9_.]*)/);
    const databaseFailure=missing?`Missing ${missing[1]}: ${missing[2]}`:/SQLITE_CONSTRAINT|constraint failed/i.test(cause.message)?'Database constraint failed':/D1_ERROR/.test(cause.message)?'D1 database operation failed':undefined;
    return{name:cause.name.replace(/[^a-zA-Z0-9_]/g,'').slice(0,80),databaseFailure,frames:cause.stack?.split('\n').filter(line=>/^\s+at /.test(line)).slice(0,6)};
  });
  console.error('[godmode] operation failed',{incidentId,code:error instanceof ServiceError?error.code:'OPERATION_FAILED',diagnostics});
  return incidentId;
}
export function errorResponse(error:unknown){
  if(error instanceof ServiceError){const incidentId=error.status>=500?logServerFailure(error):undefined;return Response.json({error:error.message,code:error.code,...(incidentId?{incidentId}:{})},{status:error.status,headers:{'Cache-Control':'no-store'}});}
  const incidentId=logServerFailure(error);
  return Response.json({error:'This operation could not be completed. Reload the town and try again.',code:'OPERATION_FAILED',incidentId},{status:500,headers:{'Cache-Control':'no-store'}});
}
