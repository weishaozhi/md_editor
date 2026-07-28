import { useState } from 'react';
import { FileTreeItem } from '@/types';
import { useFileStore } from '@/store/fileStore';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';

interface FileTreeProps {
  items: FileTreeItem[];
  onFileClick: (file: { id: number; is_folder: boolean }) => void;
  searchQuery?: string;
  level?: number;
}

export default function FileTree({ items, onFileClick, searchQuery = '', level = 0 }: FileTreeProps) {
  const { toggleFolder, isFolderExpanded } = useFileStore();

  const filteredItems = searchQuery
    ? items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  return (
    <div className="space-y-1">
      {filteredItems.map((item) => (
        <div key={item.id}>
          <div
            className={clsx(
              'flex items-center space-x-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
              'hover:bg-slate-100 dark:hover:bg-slate-700',
              level > 0 && 'ml-4'
            )}
            onClick={() => {
              if (item.is_folder) {
                toggleFolder(item.id);
              } else {
                onFileClick({ id: item.id, is_folder: item.is_folder });
              }
            }}
          >
            {item.is_folder ? (
              <>
                {isFolderExpanded(item.id) ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                {isFolderExpanded(item.id) ? (
                  <FolderOpen className="w-4 h-4 text-primary-500" />
                ) : (
                  <Folder className="w-4 h-4 text-primary-500" />
                )}
              </>
            ) : (
              <>
                <span className="w-4" />
                <FileText className="w-4 h-4 text-slate-400" />
              </>
            )}
            <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
              {item.name}
            </span>
          </div>

          {item.is_folder && isFolderExpanded(item.id) && item.children.length > 0 && (
            <FileTree
              items={item.children}
              onFileClick={onFileClick}
              searchQuery={searchQuery}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}
