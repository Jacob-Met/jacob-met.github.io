(()=>{const rm=matchMedia("(prefers-reduced-motion: reduce)").matches,d=document;
const v=d.createElement("div");v.className="veil";d.body.appendChild(v);
d.querySelectorAll(".door").forEach(el=>el.addEventListener("pointermove",e=>{const r=el.getBoundingClientRect();el.style.setProperty("--x",(e.clientX-r.left)/r.width*100+"%");el.style.setProperty("--y",(e.clientY-r.top)/r.height*100+"%")}));
if(!rm){d.addEventListener("click",e=>{const a=e.target.closest("a");if(!a||e.metaKey||e.ctrlKey||e.shiftKey||a.target||a.origin!==location.origin||a.hash&&a.pathname===location.pathname)return;e.preventDefault();d.documentElement.classList.add("leaving");setTimeout(()=>location.href=a.href,420)});
addEventListener("pageshow",()=>d.documentElement.classList.remove("leaving"));
const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target)}}),{rootMargin:"0px 0px -8% 0px"});
d.querySelectorAll(".reveal").forEach((el,i)=>{el.style.transitionDelay=Math.min(i%6,5)*60+"ms";io.observe(el)})}else d.querySelectorAll(".reveal").forEach(el=>el.classList.add("in"));})();
