export default function Login() {
  return (
    <div className="p-8 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Passwortschutz</h1>
      <form method="post" action="/api/login" className="space-y-2">
        <input type="password" name="password" placeholder="Passwort" className="border p-2 w-full" />
        <button className="bg-black text-white px-4 py-2 rounded w-full">Anmelden</button>
      </form>
    </div>
  )
}
