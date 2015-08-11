/*jshint unused: false */
/*jslint indent: 4, nomen: true */
/*globals process, require, console */
(function () {

    'use strict';

    var // variables
        defaults = {
            count: '', // nombre de documents a traiter
            indent: '    ',
            generate: false,
            always_yes: false,
            cwd: process.cwd(),
            input_extension: '.js',
            spec_extension: '.spec.js'
        },
        semver = '0.1.1',
        dfile = 'description.yml',
        // requires
        path = require('path'),
        chalk = require('chalk'),
        fse = require('fs-extra'),
        yaml = require('js-yaml'),
        args = process.argv.slice(2),
        inquirer = require('inquirer'),
        esformatter = require('esformatter'),
        // templates
        header_tpl = '/*jshint unused: false */\n/*jslint indent: 4, nomen: true */\n/*global __dirname, jasmine, process, require, define, describe, xdescribe, it, xit, expect, beforeEach, afterEach, afterLast, console */\n(function(){\n\t\'use strict\';\n',
        describe_tpl = 'describe(\'<%= description %>\', function(){<%= content %>})',
        case_tpl = 'it(\'<%= description %>\', function(){<%= content %>})',
        footer_tpl = '}());\n';

    /**
     *
     * Throw an exception is description file
     * that can not be loaded
     *
     */
    function throwloaderr(e) {
        process.stderr.write(chalk.bold.red('error: ') + chalk.red(e.message));
        process.exit(1);
    }

    /**
     *
     * On calcule le nb de documents a traiter
     * dans le document JSON
     * Si un document doit etre overwrite
     * inquirer renvoi une promesse
     * On appelle la fonction a la resolution de la promesse
     * Pour sortir proprement du process
     *
     */
    function promiseResolved(file) {
        process.stderr.write(chalk.bold('info: ') + 'file has been written\n');
        defaults.count--;
        if (defaults.count <= 0) {
            process.exit(0);
        }
    }

    /**
     *
     * Creation d'un fichier de test
     *
     */
    function write(content, file) {
        var abspath, wstream;
        try {
            // si le fichier existe
            // et que l'option est toujours à yes pour l'overwrite
            if (defaults.always_yes) {
                // overwrite
                process.stderr.write(chalk.gray('writing: ' + file + '\n'));
                fse.removeSync(file);
                fse.outputFileSync(file, content, {
                    encoding: 'utf8'
                });
                return false;
            } else {
                // overwrite
                // @TODO fix prompt async
                return {
                    type: 'confirm',
                    name: 'overwrite',
                    message: file + ' will be overwritten, continue ?',
                    default: true,
                    filter: function(ans){
                        console.log('filter');
                        if(ans){
                            return file;
                        } else {
                            return false;
                        }
                        /*
                        if(ans){
                            fse.removeSync(file);
                            fse.outputFileSync(file, content, {
                                encoding: 'utf8'
                            });
                            promiseResolved(file);
                        } else {
                            process.stderr.write(chalk.yellow.bold('warn: ') + chalk.yellow('file ' + file + ' would not be updated\n'));
                            return false;
                        }
                        */
                    }
                };
            }

        } catch (e) {
            // @TODO if file is ENOENT uniquement
            // creation du folder du fichier de test
            try {
                process.stderr.write(chalk.gray('writing: ' + file + '\n'));
                fse.outputFileSync(file, content, {
                    encoding: 'utf8'
                });
                return false;
            } catch (err) {
                throwloaderr(err);
            }
        }
    }

    function methods(keys, object) {
        var content = '';
        keys.forEach(function (name) {

        });
        return content;
    }

    /**
     *
     * Parse le document yml
     * Pour créer les fichiers de tests
     *
     */
    function parse(document) {

        var parts, input_file, file_content, output_file, formatted, result,
            child_keys, // represente le champs describe/it
            questions = [],
            spec_files_keys = Object.keys(document);

        // nb de doc a traiter
        // par la pile des promesses
        // si la pile atteint 0
        // on renvoi un process.exit(0)
        // pour sortir proprement du terminal
        defaults.count = spec_files_keys.length;

        if (defaults.count) {
            spec_files_keys.forEach(function (file) {

                parts = [
                    defaults.root,
                    path.dirname(file),
                    path.basename(file, defaults.input_extension)
                ];

                output_file = parts.join(path.sep) + defaults.spec_extension;
                output_file = path.normalize(output_file);

                file_content = header_tpl;
                //
                // child_keys = Object.keys(document[file]);
                //
                // si le type de la description
                // est une chaine de caracteres
                //
                // si la description est de type string
                // il s'agit alors du champs de type it
                /*
                if (typeof (child_keys) === 'string') {
                    // @TODO
                    file_content += parseIt(child_keys);
                } else {
                    // sinon c'est un objet
                    // il s'agit d'un champs de type describe
                    // dans ce cas on doit faire une recursion
                    // sur les enfants du noeud
                    file_content += parseDescribe(child_keys, document[file]);
                }
                */
                file_content += footer_tpl;
                formatted = esformatter.format(file_content, {
                    indent: {
                        value: defaults.indent
                    }
                });
                //
                // write file
                result = write(formatted, output_file);
                // si le resultat est une pomesse
                if (result) {
                    // on ajout une question
                    // les question viennent apres la boucle
                    questions.push(result);
                } else {
                    // sinon on informe que le fichier
                    // a bien etait ecrit
                    promiseResolved(file);
                }
            });
            if(questions.length){
                inquirer.prompt(questions, function(answers){
                    console.log(answers);
                });
            }
            // si aucune question le process est deja ferme
            // par promiseResolved();
        }
    }

    /**
     *
     * Par defaul
     *
     * Affichage dans la console
     * du fichier YAML
     *
     */
    function show(file) {
        try {
            process.stdout.write(chalk.bold.green('describing: ') + chalk.bold(file + '\n'));
            var rstream = fse.createReadStream(file, {
                encoding: 'utf8'
            });
            rstream
                .on('error', function (err) {
                    throwloaderr(err);
                })
                .on('data', function (data) {
                    process.stdout.write(data);
                }).on('end', function () {
                    process.exit(0);
                });
        } catch (e) {
            throwloaderr(e);
        }
    }

    /**
     *
     * Chargement du fichier de desctiption
     * des cas utilisateurs
     *
     */
    function load(folder, options) {
        var document, file,
            accept = false,
            generate = false;

        if (options.length) {
            defaults.always_yes = (options.indexOf('--YES') !== -1) || (options.indexOf('-Y') !== -1);
            defaults.generate = (options.indexOf('--generate') !== -1) || (options.indexOf('-g') !== -1);
        }
        //
        // variables d'object
        defaults.root = path.join(defaults.cwd, folder);
        file = path.join(defaults.root, dfile);
        if (defaults.generate) {
            try {
                yaml.safeLoadAll(fse.readFileSync(file, 'utf8'), parse);
            } catch (e) {
                throwloaderr(e);
            }
        } else {
            show(file);
        }
    }

    /**
     *
     * Affiche la version du cli
     *
     */
    function showversion() {
        process.stdout.write('v' + semver + '\n');
        process.exit(0);
    }

    /**
     *
     * Affiche l'aide du cli
     *
     */
    function showhelp() {
        process.stdout.write(chalk.bold.green('v' + semver + '\n'));
        process.stdout.write('\n');
        // Usage
        process.stdout.write('Usage: udescribe [spec_folder] [options]\n');
        process.stdout.write('       udescribe path/to/spec --describe\n');
        process.stdout.write('\n');
        //
        // Options
        process.stdout.write('Options:\n');
        process.stdout.write('  -y, --yes\t\talways say Yes! (overwrite tests files)\n');
        process.stdout.write('  -v, --version\t\tprint script version\n');
        process.stdout.write('  -g, --generate\t\tgenerate js unit tests files\n');
        process.stdout.write('\n');
        //
        // Filetypes
        process.exit(0);
    }

    /* -----------------------------------------------------------------------------
     *
     * parse les arguments du cli
     *
     ----------------------------------------------------------------------------- */
    if (!args.length) {
        process.stderr.write(chalk.bold.red('error: ') + chalk.bold('missing arguments\n'));
        process.exit(1);
        // error
    } else if (args[0] === '--help' || args[0] === '-h') {
        // affiche l'aide
        showhelp();
    } else if (args[0] === '--version' || args[0] === '-v') {
        // affiche la version
        showversion();
    } else if (args[0].trim() !== '') {
        // charge le fichier de description
        // depuis le folder en argument du cli
        load(args[0].trim(), args.slice(1));
    }

    //
    process.on('SIGINT', function () {
        process.stderr.write(chalk.bold.red('error: ') + chalk.bold('aborted by user'));
        process.exit(1);
    });

}());
