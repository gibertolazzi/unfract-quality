const fs = require('fs');
const filePath = 'components/organization/OrgDetail.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const modalRenderRegex = /\{\/\* Assign Project Modal \*\/\}\n\s*\{assignProjectModalOpen && \(\n\s*<AssignProjectModal \n\s*organization=\{org\} \n\s*onClose=\{\(\) => setAssignProjectModalOpen\(false\)\} \n\s*\/>\n\s*\)\}/;

const newModalRender = `{/* Assign Project Modal */}
      {assignProjectModalOpen && (
        <AssignProjectModal 
          organization={org} 
          onClose={() => setAssignProjectModalOpen(false)} 
        />
      )}
      
      {iamProject && (
        <ProjectIAMModal 
          project={iamProject} 
          organization={org}
          onClose={() => setIamProject(null)} 
        />
      )}
      
      {iamMember && (
        <MemberProfileModal 
          member={iamMember} 
          onClose={() => setIamMember(null)} 
        />
      )}`;

content = content.replace(modalRenderRegex, newModalRender);

fs.writeFileSync(filePath, content);
