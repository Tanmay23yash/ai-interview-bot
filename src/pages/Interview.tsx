export default function Interview() {
  const questions = localStorage.getItem("questions");

  if (!questions) {
    return <p className="text-white p-8">No interview data found.</p>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6">AI Interview</h1>

      <pre className="whitespace-pre-wrap text-gray-300">
        {questions}
      </pre>
    </div>
  );
}
