export async function readCatalogueResponse(response,compressed=false){
 if(!response.ok)throw Error('Historical catalogue could not load. Please try again online.');
 if(!compressed)return response.json();
 if(typeof DecompressionStream==='undefined')throw Error('Please update your browser to load the historical database.');
 return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json()
}

// IDs distinguish different productions sharing the same title and year.
export function mergeCatalogue(existing,projects){
 const byId=new Map(existing.map(p=>[p.id,p]));
 for(const project of projects)byId.set(project.id,project);
 return [...byId.values()]
}

export function auditionPage(offers,{query='',kind='',page=0,pageSize=20}={}){
 const q=query.trim().toLowerCase();
 const matches=offers.filter(({project,role})=>(!kind||project.kind===kind)&&(!q||[project.title,project.director,role.character,role.actor].some(v=>String(v||'').toLowerCase().includes(q))));
 const pages=Math.max(1,Math.ceil(matches.length/pageSize)),current=Math.max(0,Math.min(page,pages-1));
 return {offers:matches.slice(current*pageSize,(current+1)*pageSize),total:matches.length,pages,page:current}
}
