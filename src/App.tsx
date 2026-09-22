import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { CharactersPage } from './pages/CharactersPage';
import { CharacterPage } from './pages/CharacterPage';
import { TeamsPage } from './pages/TeamsPage';
import { GuidesPage } from './pages/GuidesPage';
import { SourcesPage } from './pages/SourcesPage';
import { LibraryPage } from './pages/LibraryPage';
import { MapPage } from './pages/MapPage';

export default function App() { return <BrowserRouter><Routes><Route element={<AppShell />}><Route path="/" element={<DashboardPage/>}/><Route path="/characters" element={<CharactersPage/>}/><Route path="/characters/:id" element={<CharacterPage/>}/><Route path="/weapons" element={<LibraryPage folder="weapons" eyebrow="WEAPONS" title="Weapon Library" description="Browse live weapon data, stats and game references from the current public dataset."/>}/><Route path="/artifacts" element={<LibraryPage folder="artifacts" eyebrow="ARTIFACTS" title="Artifact Library" description="Browse live artifact sets and their current game data from the public dataset."/>}/><Route path="/teams" element={<TeamsPage/>}/><Route path="/map" element={<MapPage/>}/><Route path="/guides" element={<GuidesPage/>}/><Route path="/sources" element={<SourcesPage/>}/><Route path="*" element={<DashboardPage/>}/></Route></Routes></BrowserRouter>; }
