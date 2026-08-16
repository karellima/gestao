export default function StatCard({ stat }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm flex items-center gap-4">
      <div className={`${stat.color} p-3 rounded-lg text-white`}>
        <stat.icon size={24} />
      </div>
      <div>
        <div className="text-sm text-gray-500">{stat.label}</div>
        <div className="text-xl font-bold">{stat.value}</div>
      </div>
    </div>
  );
}
