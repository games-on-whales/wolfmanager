"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Download, Search, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Sample game data
const GAMES = [
  {
    id: 1,
    title: "Cyberpunk 2077",
    genre: "RPG",
    size: "72 GB",
    installed: true,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 2,
    title: "Elden Ring",
    genre: "Action RPG",
    size: "60 GB",
    installed: true,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 3,
    title: "Call of Duty: Modern Warfare",
    genre: "FPS",
    size: "175 GB",
    installed: false,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 4,
    title: "Red Dead Redemption 2",
    genre: "Action Adventure",
    size: "150 GB",
    installed: false,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 5,
    title: "The Witcher 3",
    genre: "RPG",
    size: "50 GB",
    installed: true,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 6,
    title: "Grand Theft Auto V",
    genre: "Action Adventure",
    size: "105 GB",
    installed: false,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 7,
    title: "Fortnite",
    genre: "Battle Royale",
    size: "26 GB",
    installed: false,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 8,
    title: "Minecraft",
    genre: "Sandbox",
    size: "2 GB",
    installed: true,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 9,
    title: "Apex Legends",
    genre: "Battle Royale",
    size: "56 GB",
    installed: false,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 10,
    title: "League of Legends",
    genre: "MOBA",
    size: "9 GB",
    installed: false,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 11,
    title: "Valorant",
    genre: "FPS",
    size: "14 GB",
    installed: false,
    image: "/placeholder.svg?height=150&width=250",
  },
  {
    id: 12,
    title: "Destiny 2",
    genre: "FPS",
    size: "105 GB",
    installed: false,
    image: "/placeholder.svg?height=150&width=250",
  },
]

export default function GamesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [showInstalled, setShowInstalled] = useState<boolean | null>(null)
  const [installing, setInstalling] = useState<number | null>(null)
  const [filteredGames, setFilteredGames] = useState(GAMES)

  // Effect to filter games whenever search query or filters change
  useEffect(() => {
    const filtered = GAMES.filter((game) => {
      const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesGenre = selectedGenres.length === 0 || selectedGenres.includes(game.genre)
      const matchesInstalled = showInstalled === null || game.installed === showInstalled

      return matchesSearch && matchesGenre && matchesInstalled
    })

    setFilteredGames(filtered)
    console.log("Search query:", searchQuery)
    console.log("Filtered games count:", filtered.length)
  }, [searchQuery, selectedGenres, showInstalled])

  // Get unique genres for filter
  const genres = Array.from(new Set(GAMES.map((game) => game.genre)))

  const handleInstall = (gameId: number) => {
    setInstalling(gameId)
    // Simulate installation
    setTimeout(() => {
      setInstalling(null)
    }, 3000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white neon-text">Game Library</h1>
        <Select defaultValue="all">
          <SelectTrigger className="w-[180px] bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
            <SelectItem value="all">All Games</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="size">Size (Smallest first)</SelectItem>
            <SelectItem value="installed">Installed first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#01cdfe] pointer-events-none" />
          <Input
            type="search"
            placeholder="Search games library..."
            className="w-full h-10 bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] pl-8 text-white placeholder:text-gray-500 neon-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {filteredGames.length} games
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.1)] neon-border"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
            <DropdownMenuLabel>Filter by Genre</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.1)]" />
            {genres.map((genre) => (
              <DropdownMenuCheckboxItem
                key={genre}
                checked={selectedGenres.includes(genre)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedGenres([...selectedGenres, genre])
                  } else {
                    setSelectedGenres(selectedGenres.filter((g) => g !== genre))
                  }
                }}
              >
                {genre}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.1)]" />
            <DropdownMenuLabel>Installation Status</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.1)]" />
            <DropdownMenuCheckboxItem
              checked={showInstalled === true}
              onCheckedChange={() => setShowInstalled(showInstalled === true ? null : true)}
            >
              Installed
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showInstalled === false}
              onCheckedChange={() => setShowInstalled(showInstalled === false ? null : false)}
            >
              Not Installed
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredGames.map((game) => (
          <Card key={game.id} className="glass-card overflow-hidden border-none">
            <div className="aspect-video relative">
              <img src={game.image || "/placeholder.svg"} alt={game.title} className="object-cover w-full h-full" />
              {game.installed && (
                <div className="absolute top-2 right-2 bg-[#05ffa1] text-black text-xs px-2 py-1 rounded-full">
                  Installed
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <h3 className="font-bold text-white truncate">{game.title}</h3>
              <div className="flex justify-between text-sm text-gray-400 mt-1">
                <span>{game.genre}</span>
                <span>{game.size}</span>
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              {game.installed ? (
                <Button className="w-full bg-[#01cdfe] hover:bg-[#01cdfe]/80 text-black">Play</Button>
              ) : (
                <Button
                  className="w-full bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-white"
                  onClick={() => handleInstall(game.id)}
                  disabled={installing === game.id}
                >
                  {installing === game.id ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Installing...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Download className="mr-2 h-4 w-4" />
                      Install
                    </span>
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {filteredGames.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-[#01cdfe] mb-4" />
          <h3 className="text-xl font-medium text-white">No games found</h3>
          <p className="text-gray-400 mt-2">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}
