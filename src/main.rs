use anyhow::{Context, Result};
use clap::{Parser, Subcommand, ValueEnum};
use legacy_change_radar::{analyze, demo_workspace, git_diff, render_json, render_markdown};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Parser)]
#[command(name = "legacy-change-radar")]
#[command(
    version,
    about = "Map a Git diff's owners, dependencies, markers, and required checks."
)]
#[command(
    after_help = "Start with `legacy-change-radar demo`, or scan a repository with `legacy-change-radar scan --base origin/main`."
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run the analyzer on the bundled harbor application sample.
    Demo {
        /// Print JSON instead of Markdown.
        #[arg(long, value_enum, default_value_t = OutputFormat::Markdown)]
        format: OutputFormat,
        /// Write a second copy to this path instead of the demo directory.
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Analyze a Git revision range or an existing patch file.
    Scan {
        /// Repository root used for CODEOWNERS, policy, and import resolution.
        #[arg(long, default_value = ".")]
        repo: PathBuf,
        /// Base revision. When omitted, reads changes against HEAD.
        #[arg(long)]
        base: Option<String>,
        /// Head revision used with --base.
        #[arg(long, default_value = "HEAD")]
        head: String,
        /// Read this unified diff instead of running Git.
        #[arg(long, conflicts_with_all = ["base", "head"])]
        diff_file: Option<PathBuf>,
        /// Override .legacy-change-radar.toml.
        #[arg(long)]
        config: Option<PathBuf>,
        /// Select Markdown for review or JSON for scripts.
        #[arg(long, value_enum, default_value_t = OutputFormat::Markdown)]
        format: OutputFormat,
        /// Write the report to a file. Standard output is used when omitted.
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
}

#[derive(Copy, Clone, Debug, ValueEnum)]
enum OutputFormat {
    Markdown,
    Json,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("legacy-change-radar: {error:#}");
        std::process::exit(2);
    }
}

fn run() -> Result<()> {
    match Cli::parse().command {
        Commands::Demo { format, output } => run_demo(format, output),
        Commands::Scan {
            repo,
            base,
            head,
            diff_file,
            config,
            format,
            output,
        } => run_scan(
            &repo,
            base.as_deref(),
            &head,
            diff_file.as_deref(),
            config.as_deref(),
            format,
            output.as_deref(),
        ),
    }
}

fn run_demo(format: OutputFormat, output: Option<PathBuf>) -> Result<()> {
    let repo = demo_workspace()?;
    let diff_path = repo.join("sample.diff");
    let diff = fs::read_to_string(&diff_path)?;
    let report = analyze(&repo, &diff, "bundled harbor-app sample", None)?;
    let rendered = render(&report, format)?;
    let default_name = match format {
        OutputFormat::Markdown => "legacy-change-radar.md",
        OutputFormat::Json => "legacy-change-radar.json",
    };
    let output_path = output.unwrap_or_else(|| repo.join(default_name));
    write_output(&output_path, &rendered)?;
    println!("{rendered}");
    eprintln!("Demo report: {}", output_path.display());
    eprintln!("Demo workspace: {}", repo.display());
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn run_scan(
    repo: &Path,
    base: Option<&str>,
    head: &str,
    diff_file: Option<&Path>,
    config: Option<&Path>,
    format: OutputFormat,
    output: Option<&Path>,
) -> Result<()> {
    let repo = repo
        .canonicalize()
        .with_context(|| format!("could not open repository {}", repo.display()))?;
    let (diff, source) = if let Some(path) = diff_file {
        (
            fs::read_to_string(path)
                .with_context(|| format!("could not read diff file {}", path.display()))?,
            path.display().to_string(),
        )
    } else {
        git_diff(&repo, base, head)?
    };
    let report = analyze(&repo, &diff, &source, config)?;
    let rendered = render(&report, format)?;
    if let Some(path) = output {
        write_output(path, &rendered)?;
        eprintln!("Risk card: {}", path.display());
    } else {
        println!("{rendered}");
    }
    Ok(())
}

fn render(report: &legacy_change_radar::Report, format: OutputFormat) -> Result<String> {
    match format {
        OutputFormat::Markdown => Ok(render_markdown(report)),
        OutputFormat::Json => render_json(report),
    }
}

fn write_output(path: &Path, contents: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }
    fs::write(path, contents).with_context(|| format!("could not write {}", path.display()))
}
