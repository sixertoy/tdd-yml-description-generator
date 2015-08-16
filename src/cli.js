/*jslint indent: 4, nomen: true, plusplus: true */
/*globals process, require, console */
(function () {

    'use strict';

    var // variables
        description_file, // fichier de description des scenarios
        defaults = {
            files: [], // nombre de documents a traiter
            indent: '    ',
            extension: '.js',
            input_folder: '',
            cwd: process.cwd(),
            spec_extension: '.spec.js'
        },
        // lodash
        _ = require('lodash.template'),
        isarray = require('lodash.isarray'),
        // requires
        path = require('path'),
        chalk = require('chalk'),
        fse = require('fs-extra'),
        yaml = require('js-yaml'),
        inquirer = require('inquirer'),
        commander = require('commander'),
        esformatter = require('esformatter'),
        isvalidpath = require('is-valid-path');

    //
    // traitement des params args du cli
    commander
        .version('0.1.1')
        .usage('[options] <spec_folder ...>')
        .option('-Y, --yes', 'Force files overwrite')
        .option('-g, --generate', 'Generate spec files')
        .parse(process.argv);

    /**
     *
     * Par defaut
     * Au lance du cli sans options
     * Affichage dans la console
     * du fichier YAML
     *
     */
    function outputInConsole(file) {
        try {
            process.stdout.write(chalk.bold.green('describing: ') + chalk.bold(file + '\n'));
            var rstream = fse.createReadStream(file, {
                encoding: 'utf8'
            });
            rstream
                .on('error', function (err) {
                    throw err;
                })
                .on('data', function (data) {
                    process.stdout.write(data);
                }).on('end', function () {
                    process.exit(0);
                });
        } catch (e) {
            throw e;
        }
    }

    /**
     *
     * Verifciation si le fichier
     * de spec existe dans le repertoire
     * de sortie
     *
     */
    function fileExists(file) {
        try {
            fse.statSync(file);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     *
     * Creation d'un fichier de test
     *
     */
    function writeSpecFile(file, content, overwrite) {
        try {
            process.stderr.write(chalk.gray('writing: ' + file + '\n'));
            if (overwrite) {
                fse.removeSync(file);
            }
            fse.outputFileSync(file, content, {
                encoding: 'utf8'
            });
            process.stderr.write(chalk.bold.gray('info: ') + chalk.bold.gray('file has been written\n'));
        } catch (e) {
            throw e;
        }
    }

    /**
     *
     *
     *
     */
    function createQuestion(file, index) {
        file = path.relative(defaults.cwd, file);
        return {
            default: false,
            type: 'confirm',
            name: 'overwrite_' + index,
            message: file + ' will be overwritten, continue ?'
        };
    }

    /**
     *
     *
     *
     */
    function parseItCases(cases) {
        var result = '',
            compiled = _('it(\'<%- description %>\', function(){});\n');
        cases.forEach(function (value) {
            result += compiled({
                description: value
            });
        });
        return result;
    }

    function parseStories(values) {
        var cases,
            result = '',
            compiled = _('describe(\'<%- label %>\', function(){<%= value %>});\n\n');
        Object.keys(values).forEach(function(label){
            cases = values[label];
            if(isarray(cases)){
                result += compiled({
                    label: label,
                    value: parseItCases(cases)
                });
            } else {
                result += compiled({
                    label: label,
                    value: parseStories(cases)
                });
            }
        });
        return result;
    }

    /**
     *
     * Parse le document yml
     * Pour créer les fichiers de tests
     *
     */
    function parseSpecs(spec) {
        var values, output_file, will_prompt, question, data,
            prompts = [],
            prompts_data = [],
            file_content = '',
            body_content = '',
            spec_files = Object.keys(spec),
            format_options = {
                indent: {
                    value: defaults.indent
                }
            },
            compiled = _('/*jshint unused: false */\n/*jslint indent: 4, nomen: true */\n/*global __dirname, jasmine, process, require, define, describe, xdescribe, it, xit, expect, beforeEach, afterEach, afterLast, console */\n(function(){\n\t\'use strict\';\n\tvar cwd = process.cwd(),\path = require(\'path\'),\nexpect = require(\'chai\'),\nnsinon = require(\'sinon\'),\n<%= name %> = require(path.join(cwd, \'<%= file %>\'));\n\ndescribe(\'<%- name %>\', function(){\n\n<%= body %>});\n\n}());\n');

        spec_files.forEach(function (spec_file) {

            // check si le chemin de fichier est valide
            if (!isvalidpath(spec_file)) {
                return false;
            }
            //
            // nom du fichier de sortie
            output_file = path.join(defaults.cwd, defaults.folder, path.normalize(spec_file));
            output_file = output_file.replace(defaults.extension, defaults.spec_extension);
            //
            // check si le fichier existe
            will_prompt = fileExists(output_file);
            //
            // recuperation des valeurs
            // des scenarios de test
            values = spec[spec_file];
            if (!values.length) {
                // is some DESCRIBE cases
                file_content += parseStories(values);
            } else {
                // is an IT case
                file_content += parseItCases(values);
            }
            //
            // templating du body
            body_content = esformatter.format(compiled({
                file: spec_file,
                body: file_content,
                name: path.basename(spec_file, path.extname(spec_file))
            }), format_options);
            //
            // sir le fichier existe
            if (will_prompt && commander.yes) {
                output_file = path.relative(defaults.cwd, output_file);
                process.stderr.write(chalk.bold.gray('warn: ') + output_file + ' ' + chalk.bold.gray('wouldn\'t not be overwritten\n'));
                //
            } else if (will_prompt && !commander.yes) {
                question = createQuestion(output_file, prompts.length);
                prompts_data.push({
                    file: output_file,
                    content: body_content
                });
                prompts.push(question);
            } else {
                writeSpecFile(output_file, body_content);
            }
        });
        // si il y a des question
        // on envoi le prompt pour l'user
        if (prompts.length) {
            inquirer.prompt(prompts, function (answers) {
                Object.keys(answers)
                    .forEach(function (key, index) {
                        if (answers[key]) {
                            data = prompts_data[index];
                            writeSpecFile(data.file, data.content);
                        }
                    });
            });
        } else {
            // sinon on arrete le process
            process.exit(0);
        }
    }

    /* -----------------------------------------------------------------------------
     *
     * parse les arguments du cli
     *
     ----------------------------------------------------------------------------- */
    if (!commander.args.length) {
        process.stderr.write(chalk.bold.red('Error: ') + chalk.bold('missing arguments\n'));
        process.exit(1);
        // error
    }

    // construction du chemin
    // vers le fichier de description
    defaults.folder = commander.args[0];
    description_file = path.join(defaults.cwd, defaults.folder, 'stories.yml');

    // si l'argment generate
    // n'a pas ete sette par l'user
    // on redirige la sortie vers la console
    if (!commander.generate) {
        return outputInConsole(description_file);
    }
    //
    // charge le fichier de description
    // depuis le folder en argument du cli
    try {
        yaml.safeLoadAll(fse.readFileSync(description_file, 'utf8'), parseSpecs);
    } catch (e) {
        // erreur lors du process
        process.stderr.write(chalk.bold.red('Error: ') + chalk.bold(e.message) + '\n');
        console.log(e.stack);
        process.exit(1);
    }

}());