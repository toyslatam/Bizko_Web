-- =============================================================================
-- FASE — Corrige visibilidad de perfil para compañeros invitados
--
-- profiles_select_self_teammates_or_admin (0003) exigía que AMBOS lados de
-- la relación (quien mira y a quién mira) tuvieran company_members.status =
-- 'active'. Eso rompía "Usuarios y equipo" apenas invitabas a alguien: la
-- persona invitada queda en status='invited' hasta que acepta, así que su
-- fila de profiles quedaba invisible para el dueño — la consulta con
-- profile:profiles(*) devolvía profile=null y el panel fallaba al leer
-- profile.first_name/email.
--
-- Quien MIRA sigue necesitando estar activo (cm1.status='active') — un
-- invitado que aún no acepta no debería poder ver perfiles de nadie. Pero a
-- quién se mira (cm2) ya no exige estar activo: un dueño/gerente activo debe
-- poder ver el perfil de alguien que él mismo invitó, para gestionarlo.
-- =============================================================================
drop policy "profiles_select_self_teammates_or_admin" on profiles;

create policy "profiles_select_self_teammates_or_admin" on profiles for select
  using (
    id = auth.uid()
    or is_platform_admin()
    or exists (
      select 1 from company_members cm1
      join company_members cm2 on cm1.company_id = cm2.company_id
      where cm1.user_id = auth.uid() and cm1.status = 'active'
        and cm2.user_id = profiles.id and cm2.status in ('active', 'invited')
    )
  );
