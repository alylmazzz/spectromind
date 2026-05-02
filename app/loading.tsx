export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
        <h2 className="text-2xl font-bold text-white mb-2">Loading SpectroMind...</h2>
        <p className="text-gray-300">Initializing AI-powered spectroscopy analysis</p>
      </div>
    </div>
  );
}
