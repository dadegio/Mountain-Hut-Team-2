{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
      };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          # JavaScript
          nodejs
          prettierd
          typescript-language-server
          eslint

          # Testing
          hurl
          mailpit
          playwright-driver.browsers

          # DB Management + SQL formatter
          sqlitebrowser
          sqlite
          sleek

          # HTML
          djlint
        ];

        shellHook = ''
          export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
          export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
          export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
        '';
      };
    };
}
