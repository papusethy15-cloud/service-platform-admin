interface Props{page:number;pages:number;onPage:(p:number)=>void}
export default function Pagination({page,pages,onPage}:Props){
  if(pages<=1)return null
  return(<div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'flex-end',padding:'12px 16px'}}>
    <button className='btn btn-secondary btn-sm' disabled={page===1} onClick={()=>onPage(page-1)}>← Prev</button>
    <span style={{fontSize:13,color:'#64748B'}}>Page {page} of {pages}</span>
    <button className='btn btn-secondary btn-sm' disabled={page===pages} onClick={()=>onPage(page+1)}>Next →</button>
  </div>)
}
