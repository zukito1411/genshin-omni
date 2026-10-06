import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { PaimonCompanion, PaimonProvider } from './components/PaimonCompanion';
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const CharactersPage = lazy(() => import('./pages/CharactersPage').then((module) => ({ default: module.CharactersPage })));
const CharacterPage = lazy(() => import('./pages/CharacterPage').then((module) => ({ default: module.CharacterPage })));
const TeamsPage = lazy(() => import('./pages/TeamsPage').then((module) => ({ default: module.TeamsPage })));
const GuidesPage = lazy(() => import('./pages/GuidesPage').then((module) => ({ default: module.GuidesPage })));
const SourcesPage = lazy(() => import('./pages/SourcesPage').then((module) => ({ default: module.SourcesPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((module) => ({ default: module.LibraryPage })));
const MapPage = lazy(() => import('./pages/MapPage').then((module) => ({ default: module.MapPage })));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage').then((module) => ({ default: module.MaterialsPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((module) => ({ default: module.AccountPage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then((module) => ({ default: module.ComparePage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage').then((module) => ({ default: module.MyProfilePage })));
const ShowcaseCharacterPage = lazy(() => import('./pages/ShowcaseCharacterPage').then((module) => ({ default: module.ShowcaseCharacterPage })));

export default function App() {
  return (
    <BrowserRouter>
      <PaimonProvider>
        <PaimonCompanion />

        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/me" element={<MyProfilePage />} />
            <Route path="/me/:uid" element={<MyProfilePage />} />
            <Route path="/me/:uid/characters/:characterId" element={<MyProfilePage />} />
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/characters/:id" element={<CharacterPage />} />
            <Route
              path="/weapons"
              element={
                <LibraryPage
                  folder="weapons"
                  eyebrow="WEAPONS"
                  title="Weapon Library"
                  description="Browse live weapon data, stats and game references from the current public dataset."
                />
              }
            />
            <Route
              path="/artifacts"
              element={
                <LibraryPage
                  folder="artifacts"
                  eyebrow="ARTIFACTS"
                  title="Artifact Library"
                  description="Browse live artifact sets and their current game data from the public dataset."
                />
              }
            />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:uid" element={<ProfilePage />} />
            <Route path="/profile/:uid/characters/:avatar" element={<ShowcaseCharacterPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/guides" element={<GuidesPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="*" element={<DashboardPage />} />
          </Route>
        </Routes>
      </PaimonProvider>
    </BrowserRouter>
  );
}
