export default function Spinner({size='md'}:{size?:'sm'|'md'|'lg'}){
  const s=size==='sm'?16:size==='lg'?36:24
  return(<svg width={s} height={s} viewBox='0 0 24 24' fill='none' style={{animation:'spin 0.8s linear infinite'}}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <circle cx='12' cy='12' r='10' stroke='#E2E8F0' strokeWidth='3'/>
    <path d='M12 2a10 10 0 0 1 10 10' stroke='#1B4FD8' strokeWidth='3' strokeLinecap='round'/>
  </svg>)
}
