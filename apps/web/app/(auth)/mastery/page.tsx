"use client";

import { useMemo, useState } from "react";
import { Dumbbell, Flame, Sparkles, Target, Trophy } from "lucide-react";

import FitSearch from "@/components/fit/FitSearch";
import { AccessGate, FilterChips } from "@/components/member-only/MemberOnlyPageControls";
import {
  EmptyState,
  MemberCard,
  MemberGrid,
  MemberHero,
  MemberOnlyScreen,
  MemberPill,
  MemberSection,
  MemberSurface,
  StatTile,
} from "@/components/member-only/MemberOnlyPrimitives";
import {
  RANK_FILTERS,
  getInitials,
  sortMilestones,
  type MasteryTab,
  type MuscleRankFilter,
} from "@/components/member-only/MemberOnlyPageShared";
import {
  clampProgress,
  formatCompactNumber,
} from "@/components/member-only/memberOnlyUtils";
import { useMemberOnlyAccess, useMemberOnlyMasteryData } from "@/hooks/member-only/useMemberOnlyData";

export default function MasteryPage() {
  const access = useMemberOnlyAccess("Muscle Mastery");
  const { user, hasMemberCardAccess } = access;
  const [activeTab, setActiveTab] = useState<MasteryTab>("summary");
  const [muscleSearch, setMuscleSearch] = useState("");
  const [muscleRankFilter, setMuscleRankFilter] = useState<MuscleRankFilter>("all");
  const [leaderboardPage] = useState(1);
  const data = useMemberOnlyMasteryData({ hasMemberCardAccess, leaderboardPage, userId: user?.id });
  const mastery = useMemo(() => [...(data.masteryQuery.data ?? [])].sort((left, right) => right.xpPoints - left.xpPoints), [data.masteryQuery.data]);
  const milestones = useMemo(() => [...(data.milestonesQuery.data ?? [])].filter((milestone) => !milestone.isHidden).sort(sortMilestones), [data.milestonesQuery.data]);
  const leaderboard = data.leaderboardQuery.data?.data ?? [];
  const progressionProfile = data.progressionProfileQuery.data ?? null;
  const seasonStanding = data.seasonStandingQuery.data ?? null;
  const totalXp = progressionProfile?.totalXp ?? mastery.reduce((sum, entry) => sum + entry.xpPoints, 0);
  const topMuscle = mastery[0] ?? null;
  const seasonRankLabel = seasonStanding?.rankPosition ? `#${seasonStanding.rankPosition}` : "Unranked";
  const filteredMastery = mastery.filter((entry) => {
    const query = muscleSearch.trim().toLowerCase();
    const matchesSearch = !query || entry.muscleGroup.toLowerCase().includes(query);
    const matchesRank = muscleRankFilter === "all" || entry.rank === muscleRankFilter;
    return matchesSearch && matchesRank;
  });

  if (!hasMemberCardAccess) return <AccessGate featureName="Muscle Mastery" icon={Trophy} />;

  return (
    <MemberOnlyScreen>
      <MemberHero
        eyebrow="Season standing"
        title={`${formatCompactNumber(totalXp)} EXP`}
        subtitle={`Current standing ${seasonRankLabel}. ${topMuscle ? `${topMuscle.muscleGroup} leads your mastery board.` : "Complete a workout to start mastery progress."}`}
      >
        <MemberPill tone="success">{seasonStanding?.season?.title ?? "Current Season"}</MemberPill>
      </MemberHero>

      <FilterChips
        options={[
          { label: "Summary", value: "summary" },
          { label: "Muscles", value: "muscles" },
          { label: "Milestones", value: "milestones" },
          { label: "Leaderboard", value: "leaderboard" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "summary" ? (
        <MemberSection heading="Summary">
          <MemberGrid columns={4} compactPair>
            <StatTile icon={Trophy} label="Rank" value={seasonRankLabel} />
            <StatTile icon={Sparkles} label="Total EXP" value={formatCompactNumber(totalXp)} />
            <StatTile icon={Target} label="Milestones" value={String(milestones.filter((milestone) => milestone.status === "claimed").length)} />
            <StatTile icon={Flame} label="Top Muscle" value={topMuscle?.muscleGroup ?? "None"} />
          </MemberGrid>
        </MemberSection>
      ) : null}

      {activeTab === "muscles" ? (
        <MemberSection heading="Muscle Progress">
          <MemberSurface padded>
            <FitSearch value={muscleSearch} onChangeText={setMuscleSearch} placeholder="Search muscles" />
            <FilterChips options={RANK_FILTERS} value={muscleRankFilter} onChange={setMuscleRankFilter} />
          </MemberSurface>
          <MemberSurface>
            {filteredMastery.length === 0 ? (
              <EmptyState icon={Trophy} title="No mastery entries" hint="Workout sets will populate the shared mastery records." />
            ) : (
              filteredMastery.slice(0, 12).map((entry, index) => (
                <MemberCard
                  key={entry.id}
                  hasBorder={index < Math.min(filteredMastery.length, 12) - 1}
                  icon={Dumbbell}
                  label={entry.muscleGroup}
                  subtitle={`${entry.rank.toUpperCase()} | ${formatCompactNumber(entry.xpPoints)} EXP`}
                  trailingLabel={entry.rankDisplay}
                  progress={clampProgress(entry.xpPoints / Math.max(entry.xpPoints + 500, 1000))}
                />
              ))
            )}
          </MemberSurface>
        </MemberSection>
      ) : null}

      {activeTab === "milestones" ? (
        <MemberSection heading="Milestones">
          <MemberSurface>
            {milestones.length === 0 ? (
              <EmptyState icon={Target} title="No milestones yet" hint="Milestone progress is shared with mobile workouts." />
            ) : (
              milestones.slice(0, 10).map((milestone, index) => (
                <MemberCard
                  key={milestone.milestoneDefinitionId}
                  hasBorder={index < Math.min(milestones.length, 10) - 1}
                  icon={Target}
                  label={milestone.title}
                  subtitle={milestone.description}
                  trailingLabel={milestone.status === "claimed" ? "Claimed" : milestone.status === "unlocked" ? "Unlocked" : `${Math.round(milestone.progressPercent)}%`}
                  trailingTone={milestone.status === "claimed" ? "success" : milestone.status === "unlocked" ? "warning" : "brand"}
                  progress={clampProgress(milestone.progressPercent / 100)}
                  onClick={
                    milestone.status === "unlocked"
                      ? () => void data.claimMilestoneMutation.mutateAsync({ milestoneDefinitionId: milestone.milestoneDefinitionId, userId: user?.id })
                      : undefined
                  }
                />
              ))
            )}
          </MemberSurface>
        </MemberSection>
      ) : null}

      {activeTab === "leaderboard" ? (
        <MemberSection heading="Leaderboard">
          <MemberSurface>
            {leaderboard.length === 0 ? (
              <EmptyState icon={Trophy} title="Leaderboard is quiet" hint="The shared leaderboard will appear when season standings exist." />
            ) : (
              leaderboard.map((entry, index) => (
                <MemberCard
                  key={entry.userId}
                  hasBorder={index < leaderboard.length - 1}
                  avatarInitials={getInitials(entry.displayName)}
                  label={`#${entry.rankPosition} ${entry.displayName}`}
                  subtitle={`${formatCompactNumber(entry.totalXp)} EXP`}
                  trailingLabel={entry.userId === user?.id ? "You" : undefined}
                  trailingTone="success"
                />
              ))
            )}
          </MemberSurface>
        </MemberSection>
      ) : null}
    </MemberOnlyScreen>
  );
}
