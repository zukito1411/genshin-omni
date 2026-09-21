import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { CharactersPage } from './pages/CharactersPage';
import { CharacterPage } from './pages/CharacterPage';
import { TeamsPage } from './pages/TeamsPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { GuidesPage } from './pages/GuidesPage';
import { MapPage } from './pages/MapPage';
import { AccountPage } from './pages/AccountPage';
import { SourcesPage } from './pages/SourcesPage';

export default function App() { return <BrowserRouter><Routes><Route element={<AppShell />}><Route path="/" element={<DashboardPage/>}/><Route path="/characters" element={<CharactersPage/>}/><Route path="/characters/:id" element={<CharacterPage/>}/><Route path="/teams" element={<TeamsPage/>}/><Route path="/materials" element={<MaterialsPage/>}/><Route path="/guides" element={<GuidesPage/>}/><Route path="/map" element={<MapPage/>}/><Route path="/account" element={<AccountPage/>}/><Route path="/sources" element={<SourcesPage/>}/><Route path="*" element={<DashboardPage/>}/></Route></Routes></BrowserRouter>; }
