"use client";
import { UpgradeModal } from "@/components/marketing/UpgradeModal";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MegaphoneIcon } from "@/components/icons/MegaphoneIcon";
import { ChevronDown, ChevronUp, Home, CheckCircle2, Calendar, Hash, FileVideo, Users, LogOut, Check, Plus, Trash2, MessageCircle, Sparkles, Handshake, Settings, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useProject, Project } from "@/contexts/ProjectContext";
import { DeleteProjectModal } from "@/components/tasks/DeleteProjectModal";
import { CreateProjectModal } from "@/components/tasks/CreateProjectModal";
import { useState, useRef, useEffect, useMemo } from "react";
import { subscribeToDocuments, createDocument } from "@/lib/documentation";
import { Document } from "@/components/documentation/types";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/contexts/TranslationContext";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useChat } from "@/contexts/ChatContext";
import { useToast } from "@/contexts/ToastContext";
import { projectCreateMessage } from "@/lib/projects";

type DocNode = Document & { children: DocNode[] };

function buildTree(documents: Document[]): DocNode[] {
  const map = new Map<string, DocNode>();
  const roots: DocNode[] = [];
  
  documents.forEach(doc => {
    map.set(doc.id, { ...doc, children: [] });
  });
  
  documents.forEach(doc => {
    if (doc.parentId && map.has(doc.parentId)) {
      map.get(doc.parentId)!.children.push(map.get(doc.id)!);
    } else {
      roots.push(map.get(doc.id)!);
    }
  });
  
  return roots;
}

const DocTreeItem = ({ doc, activePath, depth, onAddChild }: { doc: DocNode, activePath: string, depth: number, onAddChild: (parentId: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isActive = activePath === `/documentation/${doc.id}`;
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col">
      <div 
        className={`group flex items-center gap-1.5 py-1.5 pr-2 rounded-lg transition-colors cursor-pointer ${
          isActive ? "text-white bg-white/10 font-medium" : "text-[#858585] hover:text-white hover:bg-white/5"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <div 
          className="shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer hover:bg-white/10 rounded"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (doc.children.length > 0) setIsExpanded(!isExpanded);
          }}
        >
          {doc.children.length > 0 ? (
            <ChevronDown size={14} className={`transition-transform duration-200 ${!isExpanded ? '-rotate-90' : ''}`} />
          ) : (
            <div className="w-1 h-1 rounded-full bg-white/20" />
          )}
        </div>
        <Link
          href={`/documentation/${doc.id}`}
          className="truncate flex-1 text-xs"
        >
          {doc.title}
        </Link>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddChild(doc.id);
            setIsExpanded(true); 
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-[#858585] hover:text-white transition-all shrink-0"
          title={t.sidebar.addSubDocument}
        >
          <Plus size={12} />
        </button>
      </div>
      
      {isExpanded && doc.children.length > 0 && (
        <div className="flex flex-col mt-0.5">
          {doc.children.map(child => (
            <DocTreeItem key={child.id} doc={child} activePath={activePath} depth={depth + 1} onAddChild={onAddChild} />
          ))}
        </div>
      )}
    </div>
  );
};

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loginWithGoogle, logout, loading } = useAuth();
  const { unreadCount } = useChat();
  const { t } = useTranslation();
  const { activeWorkspace, workspaces } = useWorkspace();
  const toast = useToast();
  
  const NAV_ITEMS = useMemo(() => [
    { id: "dashboard", label: t.sidebar.dashboard, Icon: Home, href: "/dashboard" },
    { id: "tasks", label: t.sidebar.tasks, Icon: CheckCircle2, href: "/" },
    { id: "calendar", label: t.sidebar.calendar, Icon: Calendar, href: "/calendar" },
    { id: "documentation", label: t.sidebar.documentation, Icon: Hash, href: "/documentation" },
    { id: "meetings", label: t.sidebar.meetings, Icon: FileVideo, href: "/meetings" },
    { id: "crm", label: t.sidebar.crm, Icon: Handshake, href: "/crm" },
    { id: "marketing", label: t.sidebar.marketing, Icon: MegaphoneIcon, href: "/marketing", disabled: true },
    { id: "organization", label: t.sidebar.organization, Icon: Users, href: "/organization" },
    { id: "chat", label: t.sidebar.chat, Icon: MessageCircle, href: "/chat" },
    { id: "ai-hub", label: t.sidebar.aiHub, Icon: Sparkles, href: "/ai-hub" },
  ], [t.sidebar]);

  const { 
    projects, 
    activeProject, 
    activeProjectId, 
    setActiveProjectId, 
    createProject, 
    renameProject,
    deleteProject
  } = useProject();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);

  useEffect(() => {
    if (onClose && isOpen) onClose();
  }, [pathname]);
  
  const [docs, setDocs] = useState<Document[]>([]);
  const [isDocsExpanded, setIsDocsExpanded] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Filter NAV_ITEMS based on structureMode
  const availableNavItems = useMemo(() => NAV_ITEMS.map(item => {
      if (item.id === "organization") {
        if (activeWorkspace?.structureMode === 'flat') {
          return { ...item, label: t.sidebar.settings };
        }
        if (activeWorkspace?.structureMode === 'teams') {
          return { ...item, label: t.sidebar.teams };
        }
        if (activeWorkspace?.structureMode === 'corporate') {
          return { ...item, label: t.sidebar.corporate };
        }
      }
      return item;
    }), [NAV_ITEMS, activeWorkspace?.structureMode, t.sidebar]);

  const [navItems, setNavItems] = useState(availableNavItems);

  useEffect(() => {
    const saved = localStorage.getItem('unfract-sidebar-order');
    if (saved) {
      try {
        const order = JSON.parse(saved);
        const reordered = order.map((id: string) => availableNavItems.find(i => i.id === id)).filter(Boolean);
        const missing = availableNavItems.filter(i => !order.includes(i.id));
        setNavItems([...reordered, ...missing] as any);
        return;
      } catch (e) {}
    }
    setNavItems(availableNavItems);
  }, [availableNavItems]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverItemId) {
      setDragOverItemId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent, id: string) => {
    if (dragOverItemId === id) {
      setDragOverItemId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverItemId(null);
    if (!draggedItemId || draggedItemId === targetId) return;

    const draggedIndex = navItems.findIndex(i => i.id === draggedItemId);
    const targetIndex = navItems.findIndex(i => i.id === targetId);

    const newItems = [...navItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    setNavItems(newItems);
    localStorage.setItem('unfract-sidebar-order', JSON.stringify(newItems.map(i => i.id)));
    setDraggedItemId(null);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  useEffect(() => {
    if (!activeProjectId) {
      setDocs([]);
      return;
    }
    const unsubscribe = subscribeToDocuments(activeProjectId, (newDocs) => {
      setDocs(newDocs);
    });
    return () => unsubscribe();
  }, [activeProjectId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isEditing && activeProject) {
      setEditValue(activeProject.name);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isEditing, activeProject]);

  const handleRenameSubmit = async () => {
    if (activeProjectId && editValue.trim() && editValue !== activeProject?.name) {
      await renameProject(activeProjectId, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRenameSubmit();
    if (e.key === "Escape") setIsEditing(false);
  };

  const handleCreateProject = () => {
    setIsDropdownOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleAddChildDocument = async (parentId: string) => {
    if (!activeProjectId || !user) return;
    const newId = await createDocument(activeProjectId, user.displayName || "Utente", parentId);
    if (newId) {
      router.push(`/documentation/${newId}?edit=true`);
    }
  };

  const docTreeRoots = buildTree(docs);

  return (
    <div className={`w-[240px] h-full bg-[#080808] text-white p-6 flex flex-col border-r border-white/5 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] fixed md:relative z-[100] ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
      {/* Logo */}
      <div className="mb-8 pl-2 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="112" height="24" viewBox="0 0 112 24" fill="none" className="max-w-full h-auto">
          <path d="M91.6338 5.97168C93.2033 5.97174 94.5633 6.26724 95.7129 6.85742C96.8631 7.4369 97.7608 8.22569 98.4053 9.22363C99.061 10.2215 99.4206 11.3432 99.4854 12.5879V12.7002H95.1162L95.084 12.5557C94.944 11.7294 94.5887 11.0423 94.0195 10.4951C93.4497 9.93731 92.676 9.65824 91.6982 9.6582C90.935 9.6582 90.2684 9.87267 89.6992 10.3018C89.1399 10.7203 88.7043 11.327 88.3926 12.1211C88.0915 12.9045 87.9414 13.8439 87.9414 14.9385V14.9541C87.9414 16.0808 88.0914 17.0418 88.3926 17.8359C88.7043 18.6192 89.1399 19.2201 89.6992 19.6387C90.2684 20.0463 90.9406 20.25 91.7139 20.25C92.66 20.25 93.4174 19.9875 93.9873 19.4619C94.5678 18.9253 94.9385 18.2217 95.0996 17.3525L95.1162 17.208H99.501V17.3047C99.4263 18.56 99.0608 19.6867 98.4053 20.6846C97.7495 21.6825 96.846 22.4771 95.6963 23.0674C94.5566 23.6467 93.219 23.9365 91.6826 23.9365C89.9307 23.9365 88.4149 23.5714 87.1357 22.8418C85.8566 22.112 84.8727 21.0768 84.1846 19.7354C83.4965 18.3833 83.1534 16.7842 83.1533 14.9385V14.9219C83.1533 13.0762 83.4965 11.4879 84.1846 10.1572C84.8832 8.8158 85.8672 7.78542 87.1357 7.06641C88.4148 6.33676 89.9143 5.97168 91.6338 5.97168ZM107.756 6.32617H110.916V9.86719H107.756V18.2383C107.756 19.043 107.933 19.6068 108.288 19.9287C108.653 20.2398 109.191 20.3955 109.9 20.3955C110.115 20.3955 110.304 20.3897 110.465 20.3789C110.626 20.3575 110.776 20.3359 110.916 20.3145V23.7598C110.658 23.8027 110.336 23.8398 109.949 23.8721C109.573 23.915 109.137 23.9365 108.643 23.9365C106.73 23.9365 105.311 23.5342 104.387 22.7295C103.462 21.9246 103 20.5988 103 18.7529V9.86719H100.598V6.32617H103V2.1084H107.756V6.32617ZM73.3828 5.97168C74.8766 5.97168 76.1723 6.21341 77.2686 6.69629C78.3653 7.1685 79.2132 7.83979 79.8154 8.70898C80.4282 9.57825 80.7344 10.592 80.7344 11.751V23.582H76.0273V21.0068H75.9307C75.6084 21.597 75.1886 22.1068 74.6729 22.5361C74.1677 22.9546 73.5924 23.2815 72.9473 23.5176C72.3027 23.7429 71.5984 23.8564 70.835 23.8564C69.6856 23.8564 68.6755 23.6361 67.8047 23.1963C66.9343 22.7456 66.2516 22.1282 65.7568 21.3447C65.2732 20.5507 65.0313 19.6493 65.0312 18.6406V18.6084C65.0312 17.5567 65.2946 16.6604 65.8213 15.9199C66.3479 15.1688 67.1114 14.5786 68.1104 14.1494C69.1102 13.7201 70.3252 13.4569 71.7549 13.3604L76.0273 13.0947V12.041C76.0273 11.2791 75.7852 10.6773 75.3018 10.2373C74.8184 9.78672 74.1132 9.56152 73.1895 9.56152C72.3079 9.56155 71.6095 9.74452 71.0938 10.1094C70.5781 10.4742 70.2598 10.9352 70.1416 11.4932L70.1104 11.6387H65.8057L65.8213 11.4453C65.9073 10.383 66.2571 9.4386 66.8691 8.6123C67.4925 7.78606 68.3524 7.14213 69.4492 6.68066C70.5559 6.20854 71.8674 5.97171 73.3828 5.97168ZM19.0186 23.582H4.75488V18.835H14.2637V0.175781H19.0186V23.582ZM33.335 5.97168C35.2373 5.97175 36.7045 6.54616 37.7363 7.69434C38.7788 8.83189 39.2998 10.4151 39.2998 12.4434V23.582H34.5918V13.4092C34.5918 12.2824 34.3235 11.4125 33.7861 10.8008C33.2595 10.1785 32.4692 9.86719 31.416 9.86719C30.7175 9.8672 30.1105 10.0288 29.5947 10.3506C29.0788 10.6618 28.675 11.1022 28.3848 11.6709C28.1055 12.2394 27.9659 12.9045 27.9658 13.666V23.582H23.2578V6.32617H27.9658V9.15918H28.0625C28.5139 8.17198 29.1802 7.39392 30.0615 6.8252C30.9429 6.2564 32.0344 5.97168 33.335 5.97168ZM49.2314 0C49.6613 6.00283e-07 50.0965 0.0215412 50.5371 0.0644531C50.9778 0.0966473 51.3329 0.139702 51.6016 0.193359V3.2998C51.4403 3.26761 51.2521 3.24608 51.0371 3.23535C50.8222 3.22463 50.6074 3.21973 50.3926 3.21973C49.6189 3.21973 49.0491 3.38038 48.6836 3.70215C48.3181 4.0241 48.1348 4.49672 48.1348 5.11914V6.32617H51.5693V9.86719H48.248V23.582H43.54V9.86719H41.1865V6.32617H43.54V4.94141C43.5401 3.81487 43.7284 2.88686 44.1045 2.15723C44.4915 1.42749 45.0992 0.885386 45.9268 0.53125C46.7651 0.177216 47.8666 0 49.2314 0ZM62.79 5.97168C63.048 5.97168 63.2957 5.98831 63.5322 6.02051C63.7685 6.0527 63.9726 6.09578 64.1445 6.14941V10.2861C63.9511 10.2111 63.7041 10.1523 63.4033 10.1094C63.1023 10.0558 62.7795 10.0283 62.4355 10.0283C61.6618 10.0283 61.0012 10.1791 60.4531 10.4795C59.9051 10.7799 59.4855 11.2195 59.1953 11.7988C58.9051 12.3783 58.7598 13.0868 58.7598 13.9238V23.582H54.0518V6.32617H58.7598V9.33594H58.8564C59.1144 8.2738 59.5819 7.44757 60.2588 6.85742C60.9359 6.26726 61.7799 5.97176 62.79 5.97168ZM72.4639 16.2578C71.5611 16.3115 70.8732 16.5267 70.4004 16.9023C69.9276 17.2672 69.6914 17.7555 69.6914 18.3672V18.3994C69.6915 19.0324 69.9327 19.5317 70.416 19.8965C70.9 20.2505 71.5505 20.4277 72.3672 20.4277C73.0658 20.4277 73.6892 20.2927 74.2373 20.0244C74.7958 19.7455 75.2313 19.3705 75.543 18.8984C75.8652 18.4156 76.0273 17.8733 76.0273 17.2725V16.0293L72.4639 16.2578ZM4.75488 18.835H0V0.175781H4.75488V18.835Z" fill="white"/>
        </svg>
      </div>
      
      {/* Project Selector */}
      <div className="relative mb-8" ref={dropdownRef}>
        {projects.length === 0 ? (
          <button
            onClick={handleCreateProject}
            className="w-full flex items-center justify-center gap-2 bg-[#006AFF] hover:bg-blue-600 text-white rounded-xl px-4 py-2.5 transition-colors font-medium text-sm"
          >
            <Plus size={16} />
            {t.sidebar.createProject}
          </button>
        ) : (
          <div 
            className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-white/10 transition-colors overflow-hidden"
            onClick={() => {
              if (!isEditing) setIsDropdownOpen(!isDropdownOpen);
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleKeyDown}
                className="bg-transparent text-sm font-medium outline-none w-full text-white"
              />
            ) : (
              <span 
                className="text-sm font-medium truncate flex-1"
                // Un clic apre il menu dei progetti, il doppio clic rinomina.
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(false);
                  setIsEditing(true);
                }}
              >
                {activeProject?.name || t.sidebar.untitledProject}
              </span>
            )}
            
            <div className="shrink-0 ml-2" onClick={(e) => {
              if (isEditing) {
                e.stopPropagation();
                handleRenameSubmit();
              }
            }}>
              <ChevronDown size={16} className={`text-[#858585] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        )}

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 w-full mt-2 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
            <div className="max-h-[200px] overflow-y-auto py-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setActiveProjectId(p.id);
                    setIsDropdownOpen(false);
                  }}
                  className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer hover:bg-white/5 transition-colors group ${activeProjectId === p.id ? 'text-white font-medium' : 'text-white/70'}`}
                >
                  <div className="flex flex-col overflow-hidden pr-4">
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] text-white/40 truncate">{workspaces.find(w => w.id === p.workspaceId)?.name || t.sidebar.unknownWorkspace}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeProjectId === p.id && <Check size={14} className="text-[#006AFF] shrink-0" />}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(p);
                      }}
                      className="text-[#808080] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 p-2">
              <button 
                onClick={handleCreateProject}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Plus size={14} />
                <span className="truncate">{t.sidebar.newProjectIn} {activeWorkspace?.name || t.sidebar.unknownWorkspace}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {projectToDelete && (
        <DeleteProjectModal 
          project={projectToDelete}
          onClose={() => setProjectToDelete(null)}
          onConfirm={async () => {
            try {
              await deleteProject(projectToDelete.id);
              setProjectToDelete(null);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Cancellazione non riuscita. Riprova.');
            }
          }}
        />
      )}
      
      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto overflow-x-hidden pr-1 pb-4">
        {navItems.map((item) => {
          const isActive = !item.disabled && (pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href)));
          const isDocMenu = item.id === "documentation";

          return (
            <div 
              key={item.id} 
              className={`flex flex-col transition-opacity ${draggedItemId === item.id ? 'opacity-30' : item.disabled ? 'opacity-40' : 'opacity-100'}`}
              draggable={!item.disabled}
              onDragStart={(e) => !item.disabled && handleDragStart(e, item.id)}
              onDragOver={(e) => !item.disabled && handleDragOver(e, item.id)}
              onDragLeave={(e) => !item.disabled && handleDragLeave(e, item.id)}
              onDrop={(e) => !item.disabled && handleDrop(e, item.id)}
              onDragEnd={handleDragEnd}
            >
              <div
                className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-xl transition-all overflow-hidden ${
                  dragOverItemId === item.id && draggedItemId !== item.id
                    ? 'ring-2 ring-[#006AFF] bg-[#006AFF]/10'
                    : isActive
                    ? "bg-[#006AFF]/40 text-white shadow-sm"
                    : "text-[#808080] hover:text-white hover:bg-white/5"
                }`}
                onClick={() => {
                  if (!item.disabled) {
                    if (isDocMenu && !isDocsExpanded) setIsDocsExpanded(true);
                    router.push(item.href);
                  }
                }}
              >
                <Link
                  href={item.disabled ? "#" : item.href}
                  className={`flex items-center gap-3 flex-1 overflow-hidden ${item.disabled ? 'cursor-not-allowed' : ''}`}
                  onClick={(e) => {
                    if (item.disabled) {
                      e.preventDefault();
                      return;
                    }
                    if (isDocMenu && !isDocsExpanded) setIsDocsExpanded(true);
                  }}
                >
                  <div className="shrink-0">
                    <item.Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <div className="flex flex-1 items-center justify-between overflow-hidden">
                    <span className={`text-[13px] truncate font-normal`}>
                      {item.label}
                    </span>
                    {item.id === 'chat' && unreadCount > 0 && (
                      <span
                        aria-label={`${unreadCount} messaggi non letti`}
                        className="ml-2 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#006AFF] px-1.5 text-[10px] font-bold leading-none text-white"
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {item.disabled && (
                      <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded flex items-center gap-1 shrink-0 ml-2">
                        <Lock size={10} />
                        {t.sidebar.soon}
                      </span>
                    )}
                  </div>
                </Link>

                {isDocMenu && (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDocsExpanded(!isDocsExpanded);
                    }}
                    className="shrink-0 ml-2 p-1 rounded-full hover:bg-white/10 text-[#858585] transition-colors"
                  >
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isDocsExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {/* Sub-menu for Documentation */}
              {isDocMenu && isDocsExpanded && (
                <div className="flex flex-col mt-1 ml-6 border-l border-white/10 gap-0.5 overflow-hidden transition-all duration-300">
                  {docTreeRoots.length === 0 ? (
                    <span className="text-xs text-[#858585] py-2 pl-4">{t.sidebar.noDocuments}</span>
                  ) : (
                    docTreeRoots.map(doc => (
                      <DocTreeItem 
                        key={doc.id} 
                        doc={doc} 
                        activePath={pathname || ""} 
                        depth={0} 
                        onAddChild={handleAddChildDocument} 
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      
      {/* Bottom Upgrade */}
      <div className="flex flex-col gap-3 mt-4 shrink-0">
        <div onClick={() => setIsUpgradeOpen(true)} className="flex items-center justify-between px-4 py-3 border border-white/10 rounded-2xl bg-gradient-to-b from-[#006AFF]/20 to-transparent cursor-pointer hover:border-[#006AFF]/50 transition-all overflow-hidden">
          <div className="flex items-center gap-2 truncate">
            <div className="shrink-0">
              <ChevronUp size={16} className="text-white" />
            </div>
            <span className="text-sm font-semibold truncate">{t.sidebar.upgrade}</span>
          </div>
        </div>

        {!loading && user && (
          <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-3 truncate">
              <UserAvatar
                src={user.photoURL}
                name={user.displayName || user.email}
                className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-[#006AFF] flex items-center justify-center text-[10px] font-bold text-white"
                imageClassName="w-full h-full rounded-full object-cover"
              />
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-white truncate">{user.displayName}</span>
                <span className="text-[10px] text-[#858585] truncate">{user.email}</span>
              </div>
            </div>
            <button onClick={logout} className="shrink-0 text-[#858585] hover:text-white transition-colors ml-2">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
      {isUpgradeOpen && <UpgradeModal onClose={() => setIsUpgradeOpen(false)} />}
      {isCreateModalOpen && (
        <CreateProjectModal 
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={async (name, organizationIds) => {
            try {
              await createProject(name, organizationIds);
            } catch (error) {
              toast.error(projectCreateMessage(error, t.tasks));
              throw error;
            }
            setIsCreateModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
