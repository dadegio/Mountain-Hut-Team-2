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

          # API Testing
          hurl

          # DB Management + SQL formatter
          sqlitebrowser
          sqlite
          sleek

          # HTML
          djlint
        ];
      };
    };
}
