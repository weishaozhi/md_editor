import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus } from 'lucide-react';

interface CollaboratorListProps {
  fileId: number;
}

export default function CollaboratorList({ fileId }: CollaboratorListProps) {
  const { data: collaborators, isLoading } = useQuery({
    queryKey: ['collaborators', fileId],
    queryFn: async () => {
      const response = await fetch(`/api/collaboration/files/${fileId}/collaborators`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return response.json();
    },
  });

  return (
    <div>
      <h3 className="font-semibold text-slate-800 dark:text-white flex items-center mb-4">
        <Users className="w-4 h-4 mr-2" />
        协作者
      </h3>

      {isLoading ? (
        <p className="text-sm text-slate-500">加载中...</p>
      ) : collaborators && collaborators.length > 0 ? (
        <div className="space-y-2">
          {collaborators.map((collab: { id: number; user_id: number; username: string; permission: string }) => (
            <div
              key={collab.id}
              className="flex items-center space-x-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700"
            >
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                  {collab.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {collab.username}
                </p>
                <p className="text-xs text-slate-500">{collab.permission}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 mb-4">暂无协作者</p>
      )}

      <button className="w-full mt-4 flex items-center justify-center space-x-2 py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 hover:border-primary-500 hover:text-primary-500 transition-colors">
        <UserPlus className="w-4 h-4" />
        <span className="text-sm">添加协作者</span>
      </button>
    </div>
  );
}
