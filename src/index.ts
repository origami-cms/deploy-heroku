import yargs from 'yargs';
import execa from 'execa';
import listr from 'listr';

const uriRegex = /^mongodb:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.*)$/m;
const argv = yargs
  .command('$0 <app>', 'Deploy an Origami app on Heroku')
  .option('skipSetup', {
    alias: 's',
    describe: 'Skip creation of the app',
    type: 'boolean',
    default: false
  })
  .option('mongo', {
    describe: 'Attach a mLab Mongo database',
    type: 'boolean'
  })
  .argv;

(async() => {
  const appFlag = ['--app', argv.app];

  const tasks = new listr();
  if (!argv.skip) {
    tasks.add({
      title: 'Creating heroku app',
      task: () => execa('heroku', ['apps:create', argv.app])
    });

    if (argv.mongo) {

      tasks.add({
        title: 'Attaching mLabs Mongo database',
        task: () => execa('heroku', ['addons:create', 'mongolab', ...appFlag])
      });

      tasks.add({
        title: 'Assigning mLab connection string to Origami env variables',
        task: async() => {
          const { stdout: uri } = await execa('heroku', ['config:get', `MONGODB_URI`, ...appFlag]);
          const [, username, password, host, port, database] = uriRegex.exec(uri)!;

          const config = { username, password, host, port, database };
          const setConfig = Object.entries(config).map(([key, value]) =>
            `ORIGAMI_STORE_${key.toUpperCase()}=${value}`
          );

          await execa('heroku', ['config:set', ...setConfig, ...appFlag]);
        }
      });
    }

    tasks.add({
      title: 'Add heroku remote to git',
      task: async() => {
        await new Promise(res => setTimeout(res, 1000));
        await execa('heroku', ['git:remote', ...appFlag]);
      }
    });
  }

  await tasks.run();

  if (!argv.skip) console.log(`Created at https://${argv.app}.herokuapp.com`);

})();

