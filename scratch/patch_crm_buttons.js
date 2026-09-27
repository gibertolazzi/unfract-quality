const fs = require('fs');
const filePath = 'app/(authenticated)/crm/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr1 = '<button\n                type="button"\n                onClick={() => setAddMenuOpen(!addMenuOpen)}\n                className="flex h-10 items-center gap-2 rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/10 px-5 text-[13px] font-medium text-[#0D6EFD] transition-colors hover:bg-[#0D6EFD]/20"';
const newStr1 = `<button
                type="button"
                onClick={() => setAddMenuOpen(!addMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm"`;
content = content.replace(targetStr1, newStr1);

const targetStr2 = '<button\n              type="button"\n              onClick={() => setCreateModal(\'opportunity\')}\n              className="flex h-10 items-center gap-2 rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/10 px-5 text-[13px] font-medium text-[#0D6EFD] transition-colors hover:bg-[#0D6EFD]/20"';
const newStr2 = `<button
              type="button"
              onClick={() => setCreateModal('opportunity')}
              className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm"`;
content = content.replace(targetStr2, newStr2);

const targetStr3 = '<button\n              type="button"\n              onClick={() => setCreateModal(\'followup\')}\n              className="flex h-10 items-center gap-2 rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/10 px-5 text-[13px] font-medium text-[#0D6EFD] transition-colors hover:bg-[#0D6EFD]/20"';
const newStr3 = `<button
              type="button"
              onClick={() => setCreateModal('followup')}
              className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm"`;
content = content.replace(targetStr3, newStr3);

fs.writeFileSync(filePath, content);
