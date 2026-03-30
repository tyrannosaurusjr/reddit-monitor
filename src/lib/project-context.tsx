"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";

export interface Project {
  id: string;
  name: string;
  slug: string;
  siteUrl: string;
  description: string;
  color: string;
  enabled: boolean;
  _count?: { subreddits: number; keywords: number; posts: number; replies: number };
}

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  setActiveProject: (project: Project) => void;
  loading: boolean;
  refreshProjects: () => void;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  activeProject: null,
  setActiveProject: () => {},
  loading: true,
  refreshProjects: () => {},
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = () => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    fetch("/api/projects")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch projects");
        return r.json();
      })
      .then((data: Project[]) => {
        if (!Array.isArray(data)) return;
        setProjects(data);
        const savedSlug = typeof window !== "undefined" ? localStorage.getItem("activeProjectSlug") : null;
        const saved = savedSlug ? data.find((p) => p.slug === savedSlug) : null;
        if (saved) {
          setActiveProjectState(saved);
        } else if (data.length > 0 && !activeProject) {
          setActiveProjectState(data[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const setActiveProject = (project: Project) => {
    setActiveProjectState(project);
    if (typeof window !== "undefined") {
      localStorage.setItem("activeProjectSlug", project.slug);
    }
  };

  useEffect(() => { fetchProjects(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ProjectContext.Provider value={{ projects, activeProject, setActiveProject, loading, refreshProjects: fetchProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
