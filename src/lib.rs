use anyhow::{Context, Result, bail};
use globset::Glob;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Report {
    pub version: String,
    pub generated_from: String,
    pub summary: Summary,
    pub files: Vec<ChangedFile>,
    pub owners: Vec<OwnerMatch>,
    pub dependency_edges: Vec<DependencyEdge>,
    pub signals: Vec<Signal>,
    pub required_checks: Vec<RequiredCheck>,
    pub notice: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
pub struct Summary {
    pub files_changed: usize,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChangedFile {
    pub path: String,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
    #[serde(skip)]
    pub added_lines: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct OwnerMatch {
    pub path: String,
    pub owners: Vec<String>,
    pub pattern: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct DependencyEdge {
    pub from: String,
    pub to: String,
    pub direction: String,
    pub evidence: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Signal {
    pub kind: String,
    pub attention: String,
    pub path: String,
    pub evidence: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct RequiredCheck {
    pub name: String,
    pub triggered_by: String,
    pub reason: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct Config {
    #[serde(default)]
    checks: Vec<CheckRule>,
    #[serde(default)]
    owners: Vec<OwnerRule>,
}

#[derive(Debug, Clone, Deserialize)]
struct CheckRule {
    name: String,
    paths: Vec<String>,
    reason: String,
}

#[derive(Debug, Clone, Deserialize)]
struct OwnerRule {
    pattern: String,
    names: Vec<String>,
}

#[derive(Debug, Clone)]
struct RawOwnerRule {
    pattern: String,
    owners: Vec<String>,
    source: String,
}

pub fn git_diff(repo: &Path, base: Option<&str>, head: &str) -> Result<(String, String)> {
    let mut args = vec!["diff", "--find-renames", "--no-ext-diff", "--unified=3"];
    let range;
    if let Some(base) = base {
        range = format!("{base}...{head}");
        args.push(&range);
    } else {
        args.push("HEAD");
    }
    let output = Command::new("git")
        .args(args)
        .current_dir(repo)
        .output()
        .with_context(|| format!("could not run git in {}", repo.display()))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        bail!("git diff failed: {message}. Check the repository and revision names");
    }
    let label = base
        .map(|value| format!("git diff {value}...{head}"))
        .unwrap_or_else(|| "git diff HEAD".to_string());
    Ok((String::from_utf8_lossy(&output.stdout).into_owned(), label))
}

pub fn analyze(
    repo: &Path,
    diff: &str,
    source: &str,
    config_path: Option<&Path>,
) -> Result<Report> {
    if !repo.exists() {
        bail!("repository path does not exist: {}", repo.display());
    }
    let files = parse_diff(diff);
    let summary = Summary {
        files_changed: files.len(),
        additions: files.iter().map(|file| file.additions).sum(),
        deletions: files.iter().map(|file| file.deletions).sum(),
    };
    let config = load_config(repo, config_path)?;
    let owners = find_owners(repo, &files, &config)?;
    let dependency_edges = find_dependency_edges(repo, &files)?;
    let signals = find_signals(&files);
    let required_checks = find_required_checks(&files, &signals, &dependency_edges, &config)?;
    Ok(Report {
        version: VERSION.to_string(),
        generated_from: source.to_string(),
        summary,
        files,
        owners,
        dependency_edges,
        signals,
        required_checks,
        notice: "This card shows review context. It does not prove that the change is correct."
            .to_string(),
    })
}

pub fn parse_diff(diff: &str) -> Vec<ChangedFile> {
    let mut files = Vec::new();
    let mut current: Option<ChangedFile> = None;
    for line in diff.lines() {
        if let Some(rest) = line.strip_prefix("diff --git a/") {
            if let Some(file) = current.take() {
                files.push(file);
            }
            let path = rest
                .split_once(" b/")
                .map(|(_, path)| path)
                .unwrap_or(rest)
                .to_string();
            current = Some(ChangedFile {
                path,
                status: "modified".to_string(),
                additions: 0,
                deletions: 0,
                added_lines: Vec::new(),
            });
        } else if let Some(file) = current.as_mut() {
            if line.starts_with("new file mode") {
                file.status = "added".to_string();
            } else if line.starts_with("deleted file mode") {
                file.status = "deleted".to_string();
            } else if let Some(path) = line.strip_prefix("rename to ") {
                file.status = "renamed".to_string();
                file.path = path.to_string();
            } else if line.starts_with('+') && !line.starts_with("+++") {
                file.additions += 1;
                file.added_lines.push(line[1..].to_string());
            } else if line.starts_with('-') && !line.starts_with("---") {
                file.deletions += 1;
            }
        }
    }
    if let Some(file) = current {
        files.push(file);
    }
    files
}

fn load_config(repo: &Path, explicit: Option<&Path>) -> Result<Config> {
    let path = explicit
        .map(PathBuf::from)
        .unwrap_or_else(|| repo.join(".legacy-change-radar.toml"));
    if !path.exists() {
        return Ok(Config::default());
    }
    let contents = fs::read_to_string(&path)
        .with_context(|| format!("could not read policy file {}", path.display()))?;
    toml::from_str(&contents)
        .with_context(|| format!("policy file {} is not valid TOML", path.display()))
}

fn find_owners(repo: &Path, files: &[ChangedFile], config: &Config) -> Result<Vec<OwnerMatch>> {
    let candidates = [
        repo.join(".github/CODEOWNERS"),
        repo.join("CODEOWNERS"),
        repo.join("docs/CODEOWNERS"),
    ];
    let codeowners_path = candidates.iter().find(|path| path.exists());
    let mut rules = Vec::new();
    if let Some(path) = codeowners_path {
        let source_name = path
            .strip_prefix(repo)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();
        for line in fs::read_to_string(path)?.lines() {
            let clean = line.split('#').next().unwrap_or("").trim();
            let parts: Vec<_> = clean.split_whitespace().collect();
            if parts.len() >= 2 {
                rules.push(RawOwnerRule {
                    pattern: parts[0].to_string(),
                    owners: parts[1..].iter().map(|value| value.to_string()).collect(),
                    source: source_name.clone(),
                });
            }
        }
    }
    rules.extend(config.owners.iter().map(|rule| RawOwnerRule {
        pattern: rule.pattern.clone(),
        owners: rule.names.clone(),
        source: ".legacy-change-radar.toml".to_string(),
    }));

    let mut result = Vec::new();
    for file in files {
        let mut matched: Option<&RawOwnerRule> = None;
        for rule in &rules {
            if path_matches(&rule.pattern, &file.path)? {
                matched = Some(rule);
            }
        }
        if let Some(rule) = matched {
            result.push(OwnerMatch {
                path: file.path.clone(),
                owners: rule.owners.clone(),
                pattern: rule.pattern.clone(),
                source: rule.source.clone(),
            });
        }
    }
    Ok(result)
}

fn find_dependency_edges(repo: &Path, changed: &[ChangedFile]) -> Result<Vec<DependencyEdge>> {
    let changed_paths: BTreeSet<_> = changed.iter().map(|file| file.path.clone()).collect();
    let source_files = collect_source_files(repo)?;
    let mut edges = BTreeSet::new();
    for path in source_files {
        let relative = path
            .strip_prefix(repo)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        let contents = match fs::read_to_string(&path) {
            Ok(contents) => contents,
            Err(_) => continue,
        };
        for (line, specifier, adapter) in extract_imports(&relative, &contents) {
            let Some(target) = resolve_import(repo, &relative, &specifier, adapter) else {
                continue;
            };
            let from_changed = changed_paths.contains(&relative);
            let to_changed = changed_paths.contains(&target);
            if from_changed || to_changed {
                let direction = if from_changed && to_changed {
                    "within change"
                } else if from_changed {
                    "outbound"
                } else {
                    "inbound"
                };
                edges.insert(DependencyEdge {
                    from: relative.clone(),
                    to: target,
                    direction: direction.to_string(),
                    evidence: line.trim().to_string(),
                    reason: format!(
                        "The {adapter} adapter resolves `{specifier}` from `{relative}` to this repository file."
                    ),
                });
            }
        }
    }
    Ok(edges.into_iter().collect())
}

fn collect_source_files(repo: &Path) -> Result<Vec<PathBuf>> {
    fn visit(root: &Path, dir: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let name = entry.file_name();
            if path.is_dir() {
                if matches!(
                    name.to_str(),
                    Some(".git" | "target" | "node_modules" | "dist")
                ) {
                    continue;
                }
                visit(root, &path, files)?;
            } else if matches!(
                path.extension().and_then(|value| value.to_str()),
                Some("js" | "jsx" | "ts" | "tsx" | "py" | "rs")
            ) && path.strip_prefix(root).is_ok()
            {
                files.push(path);
            }
        }
        Ok(())
    }
    let mut files = Vec::new();
    visit(repo, repo, &mut files)?;
    Ok(files)
}

fn extract_imports(path: &str, contents: &str) -> Vec<(String, String, &'static str)> {
    let extension = Path::new(path).extension().and_then(|value| value.to_str());
    let mut imports = Vec::new();
    match extension {
        Some("js" | "jsx" | "ts" | "tsx") => {
            let re = Regex::new(r#"(?:from\s+|import\s*\(|require\s*\()\s*[\"']([^\"']+)[\"']"#)
                .expect("valid JavaScript import pattern");
            for line in contents.lines() {
                if let Some(capture) = re.captures(line) {
                    imports.push((
                        line.to_string(),
                        capture[1].to_string(),
                        "JavaScript/TypeScript",
                    ));
                }
            }
        }
        Some("py") => {
            let from_re = Regex::new(r"^\s*from\s+([.\w]+)\s+import").unwrap();
            let import_re = Regex::new(r"^\s*import\s+([\w.]+)").unwrap();
            for line in contents.lines() {
                let capture = from_re.captures(line).or_else(|| import_re.captures(line));
                if let Some(capture) = capture {
                    imports.push((line.to_string(), capture[1].to_string(), "Python"));
                }
            }
        }
        Some("rs") => {
            let re = Regex::new(r"^\s*(?:use|mod)\s+(?:crate::)?([\w:]+)").unwrap();
            for line in contents.lines() {
                if let Some(capture) = re.captures(line) {
                    imports.push((line.to_string(), capture[1].to_string(), "Rust"));
                }
            }
        }
        _ => {}
    }
    imports
}

fn resolve_import(repo: &Path, from: &str, specifier: &str, adapter: &str) -> Option<String> {
    let from_path = Path::new(from);
    let base = from_path.parent().unwrap_or_else(|| Path::new(""));
    let raw = match adapter {
        "JavaScript/TypeScript" if specifier.starts_with('.') => base.join(specifier),
        "Python" if specifier.starts_with('.') => {
            let dots = specifier.chars().take_while(|value| *value == '.').count();
            let mut parent = base.to_path_buf();
            for _ in 1..dots {
                parent = parent.parent()?.to_path_buf();
            }
            parent.join(specifier[dots..].replace('.', "/"))
        }
        "Python" => PathBuf::from(specifier.replace('.', "/")),
        "Rust" => PathBuf::from("src").join(specifier.replace("::", "/")),
        _ => return None,
    };
    let normalized = normalize_path(&raw);
    let extensions: &[&str] = match adapter {
        "JavaScript/TypeScript" => &["ts", "tsx", "js", "jsx"],
        "Python" => &["py"],
        "Rust" => &["rs"],
        _ => &[],
    };
    let mut candidates = vec![normalized.clone()];
    for extension in extensions {
        candidates.push(normalized.with_extension(extension));
        candidates.push(normalized.join(format!("index.{extension}")));
        candidates.push(normalized.join(format!("mod.{extension}")));
    }
    candidates.into_iter().find_map(|candidate| {
        if repo.join(&candidate).is_file() {
            Some(candidate.to_string_lossy().replace('\\', "/"))
        } else {
            None
        }
    })
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            Component::ParentDir => {
                result.pop();
            }
            Component::CurDir => {}
            other => result.push(other.as_os_str()),
        }
    }
    result
}

fn find_signals(files: &[ChangedFile]) -> Vec<Signal> {
    let mut signals = Vec::new();
    for file in files {
        let lower = file.path.to_ascii_lowercase();
        let added = file.added_lines.join("\n");
        let added_lower = added.to_ascii_lowercase();
        if lower.contains("migration")
            || (lower.ends_with(".sql")
                && ["alter table", "create table", "drop table", "create index"]
                    .iter()
                    .any(|marker| added_lower.contains(marker)))
        {
            signals.push(Signal {
                kind: "migration".to_string(),
                attention: "high".to_string(),
                path: file.path.clone(),
                evidence: first_evidence(file, &["alter ", "create ", "drop "])
                    .unwrap_or_else(|| "path contains `migration`".to_string()),
                reason: "Schema changes can affect deploy order, rollback, and stored data."
                    .to_string(),
            });
        }
        let config_ext = ["toml", "yaml", "yml", "json", "ini", "env"];
        let extension = Path::new(&lower)
            .extension()
            .and_then(|value| value.to_str());
        if lower.starts_with("config/")
            || lower.contains("/config/")
            || extension.is_some_and(|value| config_ext.contains(&value))
                && !lower.ends_with("package.json")
        {
            signals.push(Signal {
                kind: "configuration".to_string(),
                attention: "medium".to_string(),
                path: file.path.clone(),
                evidence: format!("configuration-shaped path `{}`", file.path),
                reason: "Configuration changes can alter behavior without changing call sites."
                    .to_string(),
            });
        }
        if file.added_lines.iter().any(|line| {
            let line = line.trim_start();
            line.starts_with("export ")
                || line.starts_with("pub ")
                || line.contains("app.get(")
                || line.contains("app.post(")
                || line.starts_with("paths:")
        }) {
            signals.push(Signal {
                kind: "public API".to_string(),
                attention: "medium".to_string(),
                path: file.path.clone(),
                evidence: first_evidence(
                    file,
                    &["export ", "pub ", "app.get(", "app.post(", "paths:"],
                )
                .unwrap_or_else(|| "added public declaration".to_string()),
                reason: "A public declaration can affect callers outside the changed files."
                    .to_string(),
            });
        }
        if lower.ends_with(".lock")
            || lower.ends_with("-lock.json")
            || lower.contains("generated/")
            || lower.ends_with(".min.js")
            || added_lower.contains("code generated")
        {
            signals.push(Signal {
                kind: "generated artifact".to_string(),
                attention: "medium".to_string(),
                path: file.path.clone(),
                evidence: format!("generated-file marker matched `{}`", file.path),
                reason: "Generated files should match their source and generator version."
                    .to_string(),
            });
        }
    }
    signals
}

fn first_evidence(file: &ChangedFile, markers: &[&str]) -> Option<String> {
    file.added_lines.iter().find_map(|line| {
        let lower = line.to_ascii_lowercase();
        markers
            .iter()
            .any(|marker| lower.contains(marker))
            .then(|| format!("added `{}`", line.trim()))
    })
}

fn find_required_checks(
    files: &[ChangedFile],
    signals: &[Signal],
    edges: &[DependencyEdge],
    config: &Config,
) -> Result<Vec<RequiredCheck>> {
    let mut checks = BTreeSet::new();
    for signal in signals {
        let (name, reason) = match signal.kind.as_str() {
            "migration" => ("migration-review", "A migration marker was found."),
            "configuration" => ("configuration-validation", "A configuration file changed."),
            "public API" => ("public-api-contract", "A public declaration was added."),
            "generated artifact" => ("generated-artifact-sync", "A generated artifact changed."),
            _ => continue,
        };
        checks.insert(RequiredCheck {
            name: name.to_string(),
            triggered_by: signal.path.clone(),
            reason: reason.to_string(),
        });
    }
    if let Some(edge) = edges.iter().find(|edge| edge.direction == "inbound") {
        checks.insert(RequiredCheck {
            name: "dependent-tests".to_string(),
            triggered_by: edge.from.clone(),
            reason: format!("An unchanged file imports changed file `{}`.", edge.to),
        });
    }
    for rule in &config.checks {
        for file in files {
            if rule
                .paths
                .iter()
                .any(|pattern| path_matches(pattern, &file.path).unwrap_or(false))
            {
                checks.insert(RequiredCheck {
                    name: rule.name.clone(),
                    triggered_by: file.path.clone(),
                    reason: rule.reason.clone(),
                });
                break;
            }
        }
    }
    Ok(checks.into_iter().collect())
}

fn path_matches(pattern: &str, path: &str) -> Result<bool> {
    let mut normalized = pattern.trim().trim_start_matches('/').to_string();
    if normalized.ends_with('/') {
        normalized.push_str("**");
    }
    if !normalized.contains('/') {
        normalized = format!("**/{normalized}");
    }
    let matcher = Glob::new(&normalized)
        .with_context(|| format!("invalid path pattern `{pattern}`"))?
        .compile_matcher();
    Ok(matcher.is_match(path))
}

pub fn render_markdown(report: &Report) -> String {
    let mut out = String::new();
    out.push_str("# Legacy Change Radar\n\n");
    out.push_str(&format!("_Source: {}_\n\n", report.generated_from));
    if report.files.is_empty() {
        out.push_str("## No changed files found\n\n");
        out.push_str("The supplied diff contains no file changes. Check the revision range or diff file.\n\n");
        out.push_str(&format!("> {}\n", report.notice));
        return out;
    }
    out.push_str(&format!(
        "**{} files** · **+{}** additions · **−{}** deletions\n\n",
        report.summary.files_changed, report.summary.additions, report.summary.deletions
    ));
    out.push_str(
        "## Changed specimens\n\n| File | State | Lines | Owners |\n| --- | --- | ---: | --- |\n",
    );
    for file in &report.files {
        let owner = report
            .owners
            .iter()
            .find(|owner| owner.path == file.path)
            .map(|owner| owner.owners.join(", "))
            .unwrap_or_else(|| "Unmatched".to_string());
        out.push_str(&format!(
            "| `{}` | {} | +{} −{} | {} |\n",
            file.path, file.status, file.additions, file.deletions, owner
        ));
    }
    out.push_str("\n## Review signals\n\n");
    if report.signals.is_empty() {
        out.push_str(
            "No migration, configuration, public API, or generated-file markers were found.\n",
        );
    } else {
        for signal in &report.signals {
            out.push_str(&format!(
                "- **{} · {} attention** — `{}`\n  - Evidence: {}\n  - Why: {}\n",
                signal.kind, signal.attention, signal.path, signal.evidence, signal.reason
            ));
        }
    }
    out.push_str("\n## Dependency edges\n\n");
    if report.dependency_edges.is_empty() {
        out.push_str("No repository-local import edges touched the changed files.\n");
    } else {
        for edge in &report.dependency_edges {
            out.push_str(&format!(
                "- **{}:** `{}` → `{}`\n  - Evidence: `{}`\n  - Why: {}\n",
                edge.direction, edge.from, edge.to, edge.evidence, edge.reason
            ));
        }
    }
    out.push_str("\n## Required named checks\n\n");
    if report.required_checks.is_empty() {
        out.push_str("No named checks were triggered. Add repository rules when local policy requires them.\n");
    } else {
        for check in &report.required_checks {
            out.push_str(&format!(
                "- [ ] **{}** — {} Trigger: `{}`\n",
                check.name, check.reason, check.triggered_by
            ));
        }
    }
    out.push_str("\n## Owner evidence\n\n");
    if report.owners.is_empty() {
        out.push_str("No changed path matched CODEOWNERS or configured owners.\n");
    } else {
        for owner in &report.owners {
            out.push_str(&format!(
                "- `{}` → {} via `{}` in `{}`\n",
                owner.path,
                owner.owners.join(", "),
                owner.pattern,
                owner.source
            ));
        }
    }
    out.push_str(&format!("\n> {}\n", report.notice));
    out
}

pub fn render_json(report: &Report) -> Result<String> {
    Ok(serde_json::to_string_pretty(report)?)
}

pub fn demo_workspace() -> Result<PathBuf> {
    let root = std::env::temp_dir().join(format!(
        "legacy-change-radar-demo-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis()
    ));
    let files: BTreeMap<&str, &str> = BTreeMap::from([
        (
            "CODEOWNERS",
            include_str!("../examples/harbor-app/CODEOWNERS"),
        ),
        (
            ".legacy-change-radar.toml",
            include_str!("../examples/harbor-app/.legacy-change-radar.toml"),
        ),
        (
            "src/routes/berths.ts",
            include_str!("../examples/harbor-app/src/routes/berths.ts"),
        ),
        (
            "src/stores/berths.ts",
            include_str!("../examples/harbor-app/src/stores/berths.ts"),
        ),
        (
            "src/jobs/tide-reminder.ts",
            include_str!("../examples/harbor-app/src/jobs/tide-reminder.ts"),
        ),
        (
            "migrations/20260828_add_berth_depth.sql",
            include_str!("../examples/harbor-app/migrations/20260828_add_berth_depth.sql"),
        ),
        (
            "config/harbor.toml",
            include_str!("../examples/harbor-app/config/harbor.toml"),
        ),
        (
            "sample.diff",
            include_str!("../examples/harbor-app/sample.diff"),
        ),
    ]);
    for (relative, contents) in files {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, contents)?;
    }
    Ok(root)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_changed_files_and_lines() {
        let files = parse_diff(include_str!("../examples/harbor-app/sample.diff"));
        assert_eq!(files.len(), 3);
        assert_eq!(files[0].path, "src/routes/berths.ts");
        assert_eq!(files[0].additions, 4);
        assert_eq!(files[1].status, "added");
    }

    #[test]
    fn empty_diff_has_clear_markdown_state() {
        let dir = tempfile::tempdir().unwrap();
        let report = analyze(dir.path(), "", "empty.diff", None).unwrap();
        let markdown = render_markdown(&report);
        assert!(markdown.contains("No changed files found"));
        assert!(markdown.contains("Check the revision range"));
    }

    #[test]
    fn sample_finds_owners_edges_signals_and_checks() {
        let repo = Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/harbor-app");
        let diff = fs::read_to_string(repo.join("sample.diff")).unwrap();
        let report = analyze(&repo, &diff, "sample.diff", None).unwrap();
        assert_eq!(report.owners.len(), 3);
        assert!(report.dependency_edges.iter().any(|edge| {
            edge.direction == "inbound" && edge.from == "src/jobs/tide-reminder.ts"
        }));
        assert!(
            report
                .signals
                .iter()
                .any(|signal| signal.kind == "migration")
        );
        assert!(
            report
                .required_checks
                .iter()
                .any(|check| check.name == "harbor-contract-tests")
        );
    }

    #[test]
    fn json_output_is_structured() {
        let repo = Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/harbor-app");
        let diff = fs::read_to_string(repo.join("sample.diff")).unwrap();
        let report = analyze(&repo, &diff, "sample.diff", None).unwrap();
        let json: serde_json::Value = serde_json::from_str(&render_json(&report).unwrap()).unwrap();
        assert_eq!(json["summary"]["files_changed"], 3);
        assert!(json["required_checks"].is_array());
    }
}
