import React from 'react';

async function fetchRankings() {
  try {
    const response = await fetch(
      'https://3g9w6tcgxf.execute-api.eu-central-1.amazonaws.com/prod/scores',
      {
        cache: 'no-store',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to fetch rankings');
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return { men: [], women: [] };
  }
}

function RankingsTable({ players, title }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mt-8 mb-2">{title}</h2>
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2">Rank</th>
            <th className="border border-gray-300 px-4 py-2">Name</th>
            <th className="border border-gray-300 px-4 py-2">Country</th>
            <th className="border border-gray-300 px-4 py-2">Points</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            return (
              <tr key={player.rank}>
                <td className="border border-gray-300 px-4 py-2">
                  {player.rank}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {player.name}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {player.assoc}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {player.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Rankings() {
  const [rankings, setRankings] = React.useState({ men: [], women: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    async function loadRankings() {
      try {
        const data = await fetchRankings();
        setRankings({
          men: data.body.men,
          women: data.body.women,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadRankings();
  }, []); // Empty dependency array means this effect runs once on mount

  if (loading) return <p>Loading rankings...</p>;
  if (error) return <p>Error loading rankings: {error}</p>;
  if (rankings.men.length === 0 && rankings.women.length === 0) {
    return <p>No data available. Please try again later.</p>;
  }

  return (
    <div>
      <RankingsTable players={rankings.men} title="Men's Rankings" />
      <RankingsTable players={rankings.women} title="Women's Rankings" />
    </div>
  );
}

export default function RankingsPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Table Tennis World Rankings</h1>
      <Rankings />
    </div>
  );
}
function use(promise) {
  if (promise.status === 'fulfilled') {
    return promise.value;
  } else if (promise.status === 'rejected') {
    throw promise.reason;
  } else if (promise.status === 'pending') {
    throw promise;
  } else {
    promise.status = 'pending';
    promise.then(
      (result) => {
        promise.status = 'fulfilled';
        promise.value = result;
      },
      (reason) => {
        promise.status = 'rejected';
        promise.reason = reason;
      }
    );
    throw promise;
  }
}
