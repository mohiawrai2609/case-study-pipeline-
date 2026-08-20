
/* ═══ VENDOR PROFILE OVERLAY ═══ */
function openVendorProfile(vendorId){
  const overlay=document.getElementById('vendorOverlay');
  overlay.classList.add('open');
  overlay.scrollTop=0;
  document.body.style.overflow='hidden';
  // Reset forms
  document.getElementById('voBuyerForm').style.display='flex';
  document.getElementById('voBuyerOk').style.display='none';
}
function closeVendorProfile(){
  document.getElementById('vendorOverlay').classList.remove('open');
  document.body.style.overflow='';
}
// ESC key to close
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeVendorProfile()});
